import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import phoneNumberService, { recycle } from '../../../../app/registrar/phoneNumber'
import sinon from 'sinon'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import channelRepository from '../../../../app/db/repositories/channel'
import eventRepository from '../../../../app/db/repositories/event'
import common from '../../../../app/registrar/phoneNumber/common'
import { eventTypes } from '../../../../app/db/models/event'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { deepChannelFactory } from '../../../support/factories/channel'

describe('phone number services -- recycle module', () => {
  const phoneNumber = genPhoneNumber()
  let updatePhoneNumberStub,
    findChannelStub,
    destroyChannelStub,
    notifyMaintainersStub,
    notifyMembersStub,
    logEventStub

  beforeEach(() => {
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    destroyChannelStub = sinon.stub(channelRepository, 'destroy')
    logEventStub = sinon.stub(eventRepository, 'log')
    notifyMaintainersStub = sinon.stub(common, 'notifyMaintainers')
    notifyMembersStub = sinon.stub(common, 'notifyMembers')
  })

  afterEach(() => sinon.restore())

  const updatePhoneNumberSucceeds = () =>
    updatePhoneNumberStub.callsFake((phoneNumber, { status }) =>
      Promise.resolve({ phoneNumber, status }),
    )

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
