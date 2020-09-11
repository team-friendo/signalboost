import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import phoneNumberService, {
  recycle,
  requestToRecycle,
  processRecycleRequests,
} from '../../../../app/registrar/phoneNumber'
import sinon from 'sinon'
import eventRepository from '../../../../app/db/repositories/event'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import { eventTypes } from '../../../../app/db/models/event'
import { channelFactory, deepChannelFactory } from '../../../support/factories/channel'
import channelRepository from '../../../../app/db/repositories/channel'
import recycleRequestRepository from '../../../../app/db/repositories/recycleRequest'
import notifier, { notificationKeys } from '../../../../app/notifier'
import { times, map, flatten } from 'lodash'
import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'
import { eventFactory } from '../../../support/factories/event'

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
    requestToRecycleStub

  beforeEach(() => {
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    destroyChannelStub = sinon.stub(channelRepository, 'destroy')
    logEventStub = sinon.stub(eventRepository, 'log')
    notifyMaintainersStub = sinon.stub(notifier, 'notifyMaintainers')
    notifyMembersStub = sinon.stub(notifier, 'notifyMembers')
    notifyAdminsStub = sinon.stub(notifier, 'notifyAdmins')
    requestToRecycleStub = sinon.stub(recycleRequestRepository, 'requestToRecycle')
  })

  afterEach(() => sinon.restore())

  const updatePhoneNumberSucceeds = () =>
    updatePhoneNumberStub.callsFake((phoneNumber, { status }) =>
      Promise.resolve({ phoneNumber, status }),
    )

  describe('#requestToRecycle', () => {
    describe('when a phone number does not belong to a valid channel', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      it('returns an ERROR status and message', async () => {
        expect(await requestToRecycle(phoneNumbers)).to.have.deep.members([
          {
            status: 'ERROR',
            message: `${
              phoneNumbers[0]
            } must be associated with a channel in order to be recycled.`,
          },
          {
            status: 'ERROR',
            message: `${
              phoneNumbers[1]
            } must be associated with a channel in order to be recycled.`,
          },
        ])
      })
    })

    describe('when the phone number belongs to a valid channel', () => {
      beforeEach(() => {
        findChannelStub.callsFake(phoneNumber => Promise.resolve(channelFactory({ phoneNumber })))
      })

      describe('when a recycle request has already been issued for the phone number', () => {
        beforeEach(() => {
          requestToRecycleStub.returns(Promise.resolve({ wasCreated: false }))
        })

        it('attempts to issue a recycle request', async () => {
          await requestToRecycle(phoneNumbers)
          expect(requestToRecycleStub.callCount).to.eql(2)
        })

        it('returns an ERROR status and message', async () => {
          expect(await requestToRecycle(phoneNumbers)).to.have.deep.members([
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

      describe('when no recycle requests have been issued for any phone numbers', () => {
        beforeEach(() => {
          requestToRecycleStub.returns(Promise.resolve({ wasCreated: true }))
        })

        it('returns a SUCCESS status and message', async () => {
          expect(await requestToRecycle(phoneNumbers)).to.have.deep.members([
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

        it('notifies the channel admins that their channel will be recycled soon', async () => {
          await requestToRecycle(phoneNumbers)
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
        const result = await requestToRecycle(phoneNumbers)

        expect(result).to.have.deep.members([
          {
            status: 'ERROR',
            message: `Database error trying to issue recycle request for ${phoneNumbers[0]}.`,
          },
          {
            status: 'ERROR',
            message: `Database error trying to issue recycle request for ${phoneNumbers[1]}.`,
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
        requestToRecycleStub
          .onCall(0)
          .callsFake(requestNotIssuedFake)
          .onCall(1)
          .callsFake(requestIssuedFake)
      })
      it('returns different results for each phone number', async () => {
        expect(await requestToRecycle(_phoneNumbers)).to.eql([
          {
            status: 'ERROR',
            message: `Database error trying to issue recycle request for ${_phoneNumbers[0]}.`,
          },
          {
            status: 'ERROR',
            message: `${
              _phoneNumbers[1]
            } must be associated with a channel in order to be recycled.`,
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
            message: `${phoneNumber} failed to be recycled. Error: Failed to broadcast message`,
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

            it('returns successful recycled phone number statuses', async () => {
              const response = await recycle(phoneNumber)
              expect(response).to.eql({
                status: 'SUCCESS',
                message: `${phoneNumber} recycled.`,
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
                message: `${phoneNumber} failed to be recycled. Error: DB phoneNumber update failure`,
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
            message: `${phoneNumber} failed to be recycled. Error: Failed to destroy channel`,
          })
        })
      })
    })
  })

  describe('#processRecycleRequests', () => {
    const redeemed = times(2, genPhoneNumber)
    const redeemedChannels = redeemed.map(channelPhoneNumber =>
      deepChannelFactory({ channelPhoneNumber }),
    )
    const toRecycle = times(3, genPhoneNumber)
    let evaluateRecycleRequestsStub, destroyRecycleRequestsStub

    beforeEach(() => {
      // recycle helpers that should always succeed
      notifyMembersStub.returns(Promise.resolve('42'))
      logEventStub.returns(Promise.resolve(eventFactory()))
      updatePhoneNumberStub.returns(phoneNumberFactory())
      findChannelStub.callsFake(phoneNumber => Promise.resolve(channelFactory({ phoneNumber })))

      // processRecycle helpers that should always succeed
      destroyRecycleRequestsStub = sinon
        .stub(recycleRequestRepository, 'destroyMany')
        .returns(Promise.resolve())
      sinon.stub(channelRepository, 'findManyDeep').returns(Promise.resolve(redeemedChannels))
      notifyMaintainersStub.returns(Promise.resolve(['42']))
      notifyAdminsStub.returns(Promise.resolve(['42', '42']))

      // if this fails, processRecycleRequests will fail
      evaluateRecycleRequestsStub = sinon.stub(recycleRequestRepository, 'evaluateRecycleRequests')
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
        evaluateRecycleRequestsStub.returns(Promise.resolve({ redeemed, toRecycle }))
        await processRecycleRequests()
      })

      it('recycles unredeemed channels', () => {
        expect(flatten(map(destroyChannelStub.getCalls(), 'args'))).to.eql(toRecycle)
      })

      it('destroys all recycle requests that were just evaluated', () => {
        expect(destroyRecycleRequestsStub.getCall(0).args).to.eql([[...redeemed, ...toRecycle]])
      })

      it('notifies admins of redeemed channels of redemption', () => {
        expect(map(notifyAdminsStub.getCalls(), 'args')).to.eql([
          [redeemedChannels[0], notificationKeys.CHANNEL_REDEEMED],
          [redeemedChannels[1], notificationKeys.CHANNEL_REDEEMED],
        ])
      })

      it('notifies maintainers of results', () => {
        expect(notifyMaintainersStub.getCall(0).args).to.eql([
          '5 recycle requests processed:\n\n' +
            `${redeemed[0]} redeemed by admins.\n` +
            `${redeemed[1]} redeemed by admins.\n` +
            `${toRecycle[0]} recycled.\n` +
            `${toRecycle[1]} recycled.\n` +
            `${toRecycle[2]} failed to be recycled. Error: BOOM!`,
        ])
      })
    })

    describe('when job fails', () => {
      beforeEach(() => evaluateRecycleRequestsStub.callsFake(() => Promise.reject('BOOM!')))
      it('notifies maintainers of error', async () => {
        await processRecycleRequests()
        expect(notifyMaintainersStub.getCall(0).args).to.eql([
          'Error processing recycle job: BOOM!',
        ])
      })
    })
  })
})
