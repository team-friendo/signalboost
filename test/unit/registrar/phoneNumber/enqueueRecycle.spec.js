import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import signal from '../../../../app/signal/signal'
import channelRepository from '../../../../app/db/repositories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import recycleablePhoneNumberRepository from '../../../../app/db/repositories/recycleablePhoneNumber'
import { enqueueRecycleablePhoneNumber } from '../../../../app/registrar/phoneNumber'

describe('phone number services -- recycle module', () => {
  const phoneNumbers = ['+11111111111', '+12222222222']

  let db = {}
  const sock = {}

  let channel = {
    phoneNumber: genPhoneNumber(),
    name: 'beep boop channel',
  }

  let findChannelStub,
    findRecycleablePhoneNumberStub,
    enqueueRecycleablePhoneNumberStub,
    getAdminPhoneNumbersStub,
    broadcastMessageStub

  beforeEach(() => {
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    findRecycleablePhoneNumberStub = sinon.stub(
      recycleablePhoneNumberRepository,
      'findByPhoneNumber',
    )
    enqueueRecycleablePhoneNumberStub = sinon.stub(recycleablePhoneNumberRepository, 'enqueue')
    getAdminPhoneNumbersStub = sinon.stub(channelRepository, 'getAdminPhoneNumbers')
    broadcastMessageStub = sinon.stub(signal, 'broadcastMessage')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('enqueueing recycleable phone numbers', () => {
    describe('when a phone number does not belong to a valid channel', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      it('returns an ERROR status and message', async () => {
        const response = await enqueueRecycleablePhoneNumber({
          phoneNumbers: phoneNumbers.join(','),
        })
        expect(response).to.eql([
          {
            message: `${
              phoneNumbers[0]
            } must be associated with a channel in order to be recycled.`,
            status: 'ERROR',
          },
          {
            message: `${
              phoneNumbers[1]
            } must be associated with a channel in order to be recycled.`,
            status: 'ERROR',
          },
        ])
      })
    })

    describe('when the phone number has already been enqueued for recycling', () => {
      beforeEach(() => {
        // findChannelStub.returns(channel)
        findRecycleablePhoneNumberStub.returns({})
      })

      it('returns an ERROR status and message', async () => {
        const response = await enqueueRecycleablePhoneNumber({
          phoneNumbers: channel.phoneNumber,
        })
        expect(response).to.eql({
          status: 'ERROR',
          message: `${channel.phoneNumber} has already been enqueued for recycling.`,
        })
      })
    })

    describe('when the phone number belongs to a valid channel', () => {
      beforeEach(() => {
        findChannelStub.returns(Promise.resolve(channel))
      })

      it('returns a SUCCESS status and message', async () => {
        const response = await enqueueRecycleablePhoneNumber({
          phoneNumbers: phoneNumbers.join(','),
        })

        expect(enqueueRecycleablePhoneNumberStub.callCount).to.eql(1)
      })

      it('notifies the channel admins that their channel will be recycled soon', async () => {
        const response = await enqueueRecycleablePhoneNumber({
          phoneNumbers: phoneNumbers.join(','),
        })

        expect(broadcastMessageStub.callCount).to.eql(1)
      })
    })

    describe('when updating the DB throws an error', () => {
      beforeEach(() => {
        findChannelStub.callsFake(() => {
          throw 'DB err'
        })
      })

      it('returns an ERROR status and message', async () => {
        const response = await enqueueRecycleablePhoneNumber({
          phoneNumbers: phoneNumbers[0],
        })

        expect(response).to.eql([
          {
            status: 'ERROR',
            message: `There was an error trying to enqueue ${phoneNumbers[0]} for recycling.`,
          },
        ])
      })
    })
  })
})
