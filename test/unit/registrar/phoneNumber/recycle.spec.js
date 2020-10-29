import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import phoneNumberService, {
  recycle,
  requestToDestroy,
  processDestructionRequests,
} from '../../../../app/registrar/phoneNumber'
import sinon from 'sinon'
import eventRepository from '../../../../app/db/repositories/event'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import { eventTypes } from '../../../../app/db/models/event'
import { channelFactory, deepChannelFactory } from '../../../support/factories/channel'
import channelRepository from '../../../../app/db/repositories/channel'
import destructionRequestRepository from '../../../../app/db/repositories/destructionRequest'
import notifier, { notificationKeys } from '../../../../app/notifier'
import { times, map, flatten } from 'lodash'
import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'
import { eventFactory } from '../../../support/factories/event'
import { redeem } from '../../../../app/registrar/phoneNumber/recycle'

describe('phone number registrar -- recycle module', () => {
  const phoneNumber = genPhoneNumber()
  const phoneNumbers = times(2, genPhoneNumber)
  let updatePhoneNumberStub,
    findChannelStub,
    destroyChannelStub,
    logEventStub,
    notifyAdminsStub,
    notifyMaintainersStub,
    notifyMembersStub,
    requestToDestroyStub

  beforeEach(() => {
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    destroyChannelStub = sinon.stub(channelRepository, 'destroy')
    logEventStub = sinon.stub(eventRepository, 'log')
    notifyMaintainersStub = sinon.stub(notifier, 'notifyMaintainers')
    notifyMembersStub = sinon.stub(notifier, 'notifyMembers')
    notifyAdminsStub = sinon.stub(notifier, 'notifyAdmins')
    requestToDestroyStub = sinon.stub(destructionRequestRepository, 'requestToDestroy')
  })

  afterEach(() => sinon.restore())

  const updatePhoneNumberSucceeds = () =>
    updatePhoneNumberStub.callsFake((phoneNumber, { status }) =>
      Promise.resolve({ phoneNumber, status }),
    )

  describe('#requestToDestroy', () => {
    describe('when a phone number does not belong to a valid channel', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      it('returns an ERROR status and message', async () => {
        expect(await requestToDestroy(phoneNumbers)).to.have.deep.members([
          {
            status: 'ERROR',
            message: `${
              phoneNumbers[0]
            } must be associated with a channel in order to be destroyed.`,
          },
          {
            status: 'ERROR',
            message: `${
              phoneNumbers[1]
            } must be associated with a channel in order to be destroyed.`,
          },
        ])
      })
    })

    describe('when the phone number belongs to a valid channel', () => {
      beforeEach(() => {
        findChannelStub.callsFake(phoneNumber => Promise.resolve(channelFactory({ phoneNumber })))
      })

      describe('when a destruction request has already been issued for the phone number', () => {
        beforeEach(() => {
          requestToDestroyStub.returns(Promise.resolve({ wasCreated: false }))
        })

        it('attempts to issue a destruction request', async () => {
          await requestToDestroy(phoneNumbers)
          expect(requestToDestroyStub.callCount).to.eql(2)
        })

        it('returns an ERROR status and message', async () => {
          expect(await requestToDestroy(phoneNumbers)).to.have.deep.members([
            {
              status: 'ERROR',
              message: `${phoneNumbers[0]} has already been enqueued for recycling.`,
            },
            {
              status: 'ERROR',
              message: `${phoneNumbers[1]} has already been enqueued for recycling.`,
            },
          ])
        })
      })

      describe('when no destruction requests have been issued for any phone numbers', () => {
        beforeEach(() => {
          requestToDestroyStub.returns(Promise.resolve({ wasCreated: true }))
        })

        it('returns a SUCCESS status and message', async () => {
          expect(await requestToDestroy(phoneNumbers)).to.have.deep.members([
            {
              status: 'SUCCESS',
              message: `Issued request to recycle ${phoneNumbers[0]}.`,
            },
            {
              status: 'SUCCESS',
              message: `Issued request to recycle ${phoneNumbers[1]}.`,
            },
          ])
        })

        it('notifies the channel admins that their channel will be destroyed soon', async () => {
          await requestToDestroy(phoneNumbers)
          notifyAdminsStub
            .getCalls()
            .map(call => call.args)
            .forEach(([channel, notificationKey]) => {
              expect(phoneNumbers).to.include(channel.phoneNumber)
              expect(notificationKey).to.eql('channelEnqueuedForRecycling')
            })
        })
      })
    })

    describe('when updating the DB throws an error', () => {
      beforeEach(() => findChannelStub.callsFake(() => Promise.reject('DB err')))

      it('returns an ERROR status and message', async () => {
        const result = await requestToDestroy(phoneNumbers)

        expect(result).to.have.deep.members([
          {
            status: 'ERROR',
            message: `Database error trying to issue destruction request for ${phoneNumbers[0]}.`,
          },
          {
            status: 'ERROR',
            message: `Database error trying to issue destruction request for ${phoneNumbers[1]}.`,
          },
        ])
      })
    })

    describe('when some requests succeed and others fail', () => {
      const _phoneNumbers = times(4, genPhoneNumber)
      const createChannelFake = phoneNumber => Promise.resolve(channelFactory({ phoneNumber }))
      const requestIssuedFake = () => Promise.resolve({ wasCreated: true })
      const requestNotIssuedFake = () => Promise.resolve({ wasCreated: false })

      beforeEach(() => {
        findChannelStub
          .onCall(0)
          .callsFake(() => Promise.reject('BOOM!'))
          .onCall(1)
          .returns(Promise.resolve(null))
          .onCall(2)
          .callsFake(createChannelFake)
          .onCall(3)
          .callsFake(createChannelFake)
        requestToDestroyStub
          .onCall(0)
          .callsFake(requestNotIssuedFake)
          .onCall(1)
          .callsFake(requestIssuedFake)
      })
      it('returns different results for each phone number', async () => {
        expect(await requestToDestroy(_phoneNumbers)).to.eql([
          {
            status: 'ERROR',
            message: `Database error trying to issue destruction request for ${_phoneNumbers[0]}.`,
          },
          {
            status: 'ERROR',
            message: `${
              _phoneNumbers[1]
            } must be associated with a channel in order to be destroyed.`,
          },
          {
            status: 'ERROR',
            message: `${_phoneNumbers[2]} has already been enqueued for recycling.`,
          },
          {
            status: 'SUCCESS',
            message: `Issued request to recycle ${_phoneNumbers[3]}.`,
          },
        ])
      })
    })
  })

  describe('#recycle', () => {
    describe('when the phone number does not belong to a valid channel', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      it('returns a channel not found status', async () => {
        const response = await recycle(phoneNumber)
        expect(response).to.eql({
          message: `Channel not found for ${phoneNumber}`,
          status: 'ERROR',
        })
      })
    })

    describe('when the phone number does belong to a valid channel', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(deepChannelFactory({ phoneNumber })))
      })

      describe('when notifying members of channel recycling fails', () => {
        beforeEach(async () => {
          notifyMembersStub.callsFake(() => Promise.reject('Failed to broadcast message'))
        })

        it('returns a failed status', async () => {
          expect(await recycle(phoneNumber)).to.eql({
            status: 'ERROR',
            message: `${phoneNumber} failed to be destroyed. Error: Failed to broadcast message`,
          })
        })
      })

      describe('when notifying members of channel recycling succeeds', () => {
        beforeEach(async () => notifyMembersStub.returns(Promise.resolve()))

        describe('when the channel destruction succeeds', () => {
          beforeEach(() => destroyChannelStub.returns(Promise.resolve()))

          describe('when the phoneNumber update succeeds', () => {
            beforeEach(() => updatePhoneNumberSucceeds())

            it('notifies the members of the channel of destruction', async () => {
              await recycle(phoneNumber)
              expect(notifyMembersStub.callCount).to.eql(1)
            })

            it('adds a CHANNEL_DESTROYED event to the event log', async () => {
              await phoneNumberService.recycle(phoneNumber)
              expect(logEventStub.getCall(0).args).to.eql([
                eventTypes.CHANNEL_DESTROYED,
                phoneNumber,
              ])
            })

            it('updates the phone number record to verified', async () => {
              await recycle(phoneNumber)

              expect(updatePhoneNumberStub.getCall(0).args).to.eql([
                phoneNumber,
                { status: 'VERIFIED' },
              ])
            })

            it('successfully destroys the channel', async () => {
              await recycle(phoneNumber)
              expect(destroyChannelStub.callCount).to.eql(1)
            })

            it('returns successful destroyed phone number statuses', async () => {
              const response = await recycle(phoneNumber)
              expect(response).to.eql({
                status: 'SUCCESS',
                message: `${phoneNumber} destroyed.`,
              })
            })
          })

          describe('when the phoneNumber status update fails', () => {
            beforeEach(() =>
              updatePhoneNumberStub.callsFake(() =>
                Promise.reject('DB phoneNumber update failure'),
              ),
            )

            it('returns a failed status', async () => {
              const response = await recycle(phoneNumber)
              expect(response).to.eql({
                status: 'ERROR',
                message: `${phoneNumber} failed to be destroyed. Error: DB phoneNumber update failure`,
              })
            })
          })
        })
      })

      describe('when the channel destruction fails', () => {
        beforeEach(() => {
          destroyChannelStub.callsFake(() => Promise.reject('Failed to destroy channel'))
        })

        it('returns a failed status', async () => {
          const response = await recycle(phoneNumber)
          expect(response).to.eql({
            status: 'ERROR',
            message: `${phoneNumber} failed to be destroyed. Error: Failed to destroy channel`,
          })
        })
      })
    })
  })

  describe('#processDestructionRequests', () => {
    const toDestroy = times(3, genPhoneNumber)
    let getMatureDestructionRequestsStub, destroyDestructionRequestsStub

    beforeEach(() => {
      // recycle helpers that should always succeed
      notifyMembersStub.returns(Promise.resolve('42'))
      logEventStub.returns(Promise.resolve(eventFactory()))
      updatePhoneNumberStub.returns(phoneNumberFactory())
      findChannelStub.callsFake(phoneNumber => Promise.resolve(channelFactory({ phoneNumber })))

      // processRecycle helpers that should always succeed
      destroyDestructionRequestsStub = sinon
        .stub(destructionRequestRepository, 'destroyMany')
        .returns(Promise.resolve(toDestroy.length))
      notifyMaintainersStub.returns(Promise.resolve(['42']))
      notifyAdminsStub.returns(Promise.resolve(['42', '42']))

      // if this fails, processDestructionRequests will fail
      getMatureDestructionRequestsStub = sinon.stub(
        destructionRequestRepository,
        'getMatureDestructionRequests',
      )
    })

    describe('when processing succeeds', () => {
      beforeEach(async () => {
        // recycle succeeds twice, fails once
        destroyChannelStub
          .onCall(0)
          .returns(Promise.resolve(true))
          .onCall(1)
          .returns(Promise.resolve(true))
          .onCall(2)
          .callsFake(() => Promise.reject('BOOM!'))
        // overall job succeeds
        getMatureDestructionRequestsStub.returns(Promise.resolve(toDestroy))
        await processDestructionRequests()
      })

      it('recycles channels with mature destruction requests', () => {
        expect(flatten(map(destroyChannelStub.getCalls(), 'args'))).to.eql(toDestroy)
      })

      it('destroys all destruction requests that were just processed', () => {
        expect(destroyDestructionRequestsStub.getCall(0).args).to.eql([toDestroy])
      })

      it('notifies maintainers of results', () => {
        expect(notifyMaintainersStub.getCall(0).args).to.eql([
          '3 destruction requests processed:\n\n' +
            `${toDestroy[0]} destroyed.\n` +
            `${toDestroy[1]} destroyed.\n` +
            `${toDestroy[2]} failed to be destroyed. Error: BOOM!`,
        ])
      })
    })

    describe('when job fails', () => {
      beforeEach(() => getMatureDestructionRequestsStub.callsFake(() => Promise.reject('BOOM!')))
      it('notifies maintainers of error', async () => {
        await processDestructionRequests()
        expect(notifyMaintainersStub.getCall(0).args).to.eql([
          'Error processing recycle job: BOOM!',
        ])
      })
    })
  })
  describe('#redeem', () => {
    const channelToRedeem = deepChannelFactory({ phoneNumber })
    let destroyDestructionRequestStub
    beforeEach(() => (destroyDestructionRequestStub = sinon.stub(destructionRequestRepository, 'destroy')))

    describe('when all tasks succeed', () => {
      beforeEach(async () => {
        destroyDestructionRequestStub.returns(Promise.resolve(1))
        notifyMaintainersStub.returns(Promise.resolve(['42']))
        notifyAdminsStub.returns(Promise.resolve(['42', '42']))
        await redeem(channelToRedeem)
      })

      it('deletes the destruction requests for redeemed channels', () => {
        expect(destroyDestructionRequestStub.getCall(0).args).to.eql([phoneNumber])
      })

      it('notifies admins of redeemed channels of redemption', () => {
        expect(notifyAdminsStub.getCall(0).args).to.eql([
          channelToRedeem,
          notificationKeys.CHANNEL_REDEEMED,
        ])
      })

      it('notifies maintainers of results', () => {
        expect(notifyMaintainersStub.getCall(0).args).to.eql([
          `${phoneNumber} had been scheduled for recycling, but was just redeemed.`,
        ])
      })
    })
  })
})
