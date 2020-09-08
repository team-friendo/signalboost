import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import phoneNumberService, {
  recycle,
  requestToRecycle,
} from '../../../../app/registrar/phoneNumber'
import sinon from 'sinon'
import common from '../../../../app/registrar/phoneNumber/common'
import channelRepository from '../../../../app/db/repositories/channel'
import eventRepository from '../../../../app/db/repositories/event'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import recycleRequestRepository from '../../../../app/db/repositories/recycleRequest'
import { eventTypes } from '../../../../app/db/models/event'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory, deepChannelFactory } from '../../../support/factories/channel'
import { times } from 'lodash'

describe('phone number services -- recycle module', () => {
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
    notifyMaintainersStub = sinon.stub(common, 'notifyMaintainers')
    notifyMembersStub = sinon.stub(common, 'notifyMembers')
    notifyAdminsStub = sinon.stub(common, 'notifyAdmins')
    requestToRecycleStub = sinon.stub(recycleRequestRepository, 'requestToRecycle')
  })

  afterEach(() => sinon.restore())

  const updatePhoneNumberSucceeds = () =>
    updatePhoneNumberStub.callsFake((phoneNumber, { status }) =>
      Promise.resolve({ phoneNumber, status }),
    )

  describe('issuing a request to recycle several phone numbers', () => {
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

  describe('recycling a phone number', () => {
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
            message: `Failed to recycle channel for ${phoneNumber}. Error: Failed to broadcast message`,
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
                data: { phoneNumber: phoneNumber, status: 'VERIFIED' },
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
                message: `Failed to recycle channel for ${phoneNumber}. Error: DB phoneNumber update failure`,
              })
            })
          })
        })
      })

      describe('when the channel destruction fails', () => {
        beforeEach(() => {
          notifyMembersStub.returns(Promise.resolve())
          destroyChannelStub.callsFake(() => Promise.reject('Failed to destroy channel'))
        })

        it('notifies the instance maintainers with a channel failure message', async () => {
          await recycle(phoneNumber)
          expect(notifyMaintainersStub.getCall(0).args).to.eql([
            `Failed to recycle channel for phone number: ${phoneNumber}`,
          ])
        })

        it('returns a failed status', async () => {
          const response = await recycle(phoneNumber)
          expect(response).to.eql({
            status: 'ERROR',
            message: `Failed to recycle channel for ${phoneNumber}. Error: Failed to destroy channel`,
          })
        })
      })
    })
  })
})
