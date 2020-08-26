import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import commonService from '../../../../app/registrar/phoneNumber/common'
import { destroy } from '../../../../app/registrar/phoneNumber/destroy'
import sinon from 'sinon'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import channelRepository from '../../../../app/db/repositories/channel'
import eventRepository from '../../../../app/db/repositories/event'
import signal from '../../../../app/signal'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import { deepChannelFactory } from '../../../support/factories/channel'
import { eventFactory } from '../../../support/factories/event'
import { eventTypes } from '../../../../app/db/models/event'
const fs = require('fs-extra')

describe('phone number services -- destroy module', () => {
  // SETUP
  const phoneNumber = '+11111111111'
  let findChannelStub,
    findPhoneNumberStub,
    broadcastMessageStub,
    releasePhoneNumberStub,
    destroyChannelSpy,
    destroyPhoneNumberSpy,
    deleteDirStub,
    twilioRemoveSpy,
    signaldUnsubscribeStub,
    logEventStub

  const destroyChannelSucceeds = () =>
    findChannelStub.callsFake((_, phoneNumber) =>
      Promise.resolve({
        destroy: destroyChannelSpy,
        phoneNumber,
        memberships: [{ memberPhoneNumber: '+12223334444' }, { memberPhoneNumber: '+15556667777' }],
      }),
    )

  const channelDoesNotExist = () => findChannelStub.callsFake(() => Promise.resolve(null))

  const destroyChannelFails = () =>
    findChannelStub.callsFake((_, phoneNumber) =>
      Promise.resolve({
        destroy: () => {
          throw 'Failed to destroy channel'
        },
        phoneNumber,
        memberships: [],
      }),
    )

  const destroyChannelNotCalled = () => findChannelStub.returns(deepChannelFactory({ phoneNumber }))

  const destroyPhoneNumberSucceeds = () =>
    findPhoneNumberStub.callsFake((_, phoneNumber) =>
      Promise.resolve({ destroy: destroyPhoneNumberSpy, phoneNumber, twilioSid: 'PN123' }),
    )

  const destroyPhoneNumberFails = () =>
    findPhoneNumberStub.callsFake((_, phoneNumber) =>
      Promise.resolve({
        destroy: () => {
          throw 'Failed to destroy phone number'
        },
        phoneNumber,
        twilioSid: 'PN123',
      }),
    )

  const destroySignalEntrySucceeds = () => {}

  const destroySignalEntryFails = async () => {
    deleteDirStub.throws()
  }

  const releasePhoneNumberSucceeds = () => {
    releasePhoneNumberStub.callsFake(() => ({
      incomingPhoneNumbers: () => ({ remove: () => twilioRemoveSpy() }),
    }))
  }

  const releasePhoneNumberFails = () => {
    releasePhoneNumberStub.throws({ message: 'oh noes!' })
  }

  const broadcastMessageSucceeds = () => broadcastMessageStub.returns(Promise.resolve())

  const signaldUnsubscribeFails = () =>
    signaldUnsubscribeStub.throws(() => {
      return new Error('Signald failed to unsubscribe')
    })

  before(async () => {
    await app.run(testApp)
  })

  beforeEach(() => {
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    findPhoneNumberStub = sinon.stub(phoneNumberRepository, 'find')
    broadcastMessageStub = sinon.stub(signal, 'broadcastMessage')
    destroyChannelSpy = sinon.spy()
    destroyPhoneNumberSpy = sinon.spy()
    twilioRemoveSpy = sinon.spy()
    releasePhoneNumberStub = sinon.stub(commonService, 'getTwilioClient')
    deleteDirStub = sinon.stub(fs, 'remove').returns(['/var/lib'])
    signaldUnsubscribeStub = sinon.stub(signal, 'unsubscribe')
    logEventStub = sinon
      .stub(eventRepository, 'log')
      .returns(Promise.resolve(eventFactory({ type: eventTypes.CHANNEL_DESTROYED })))
  })

  afterEach(() => sinon.restore())
  after(async () => await app.stop())

  // TESTS

  describe('destroying phone numbers', () => {
    describe('when phone number does not exist in channels db', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      describe('when phone number does not exist in phone number db', () => {
        beforeEach(async () => {
          findPhoneNumberStub.returns(Promise.resolve(null))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: 'No records found for +11111111111',
            status: 'ERROR',
          })
        })
      })

      describe('when no channel exists with with given phone number', () => {
        beforeEach(async () => {
          channelDoesNotExist()
          broadcastMessageSucceeds()
          destroySignalEntrySucceeds()
          releasePhoneNumberSucceeds()
          destroyPhoneNumberSucceeds()
        })

        it('destroys the phone number', async () => {
          await destroy({ phoneNumber })
          expect(destroyPhoneNumberSpy.callCount).to.eql(1)
        })

        it('releases the phone number back to twilio', async () => {
          await destroy({ phoneNumber })
          expect(twilioRemoveSpy.callCount).to.eql(1)
        })

        it('returns SUCCESS', async () => {
          const response = await destroy({ phoneNumber })
          expect(response.status).to.eql('SUCCESS')
        })

        it('does not attempt to notify members of non-existent channel', async () => {
          await destroy({ phoneNumber })
          expect(broadcastMessageStub.callCount).to.eql(0)
        })

        it('does not attempt to destroy a channel', async () => {
          await destroy({ phoneNumber })
          expect(destroyChannelSpy.callCount).to.eql(0)
        })
      })
    })

    describe('when channel exists with given phone number', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve({}))
      })

      describe('all tasks succeed', () => {
        beforeEach(async () => {
          broadcastMessageSucceeds()
          destroyChannelSucceeds()
          destroySignalEntrySucceeds()
          releasePhoneNumberSucceeds()
          destroyPhoneNumberSucceeds()
        })

        describe('destroy command called from maintainer', () => {
          it('notifies all the members of the channel of destruction', async () => {
            await destroy({ phoneNumber })
            expect(broadcastMessageStub.getCall(0).args[0]).to.eql(['+12223334444', '+15556667777'])
          })
        })

        describe('destroy command called from admin of channel', () => {
          it('notifies all members of the channel except for the sender', async () => {
            await destroy({ phoneNumber, sender: '+15556667777' })
            expect(broadcastMessageStub.getCall(0).args[0]).to.eql(['+12223334444'])
          })
        })

        it('destroys the channel in the db', async () => {
          await destroy({ phoneNumber })
          expect(destroyChannelSpy.callCount).to.eql(1)
        })

        it('logs a CHANNEL_DESTROYED event', async () => {
          await destroy({ phoneNumber })
          expect(logEventStub.getCall(0).args.slice(0, -1)).to.eql([
            eventTypes.CHANNEL_DESTROYED,
            phoneNumber,
          ])
        })

        it('deletes the associated signal data dir', async () => {
          await destroy({ phoneNumber })
          expect(deleteDirStub.getCall(0).args[0]).to.eql('/var/lib/signald/data/+11111111111')
        })

        it('releases the phone number to twilio', async () => {
          await destroy({ phoneNumber })
          expect(twilioRemoveSpy.callCount).to.eql(1)
        })

        it('destroys the phoneNumber in the db', async () => {
          await destroy({ phoneNumber })
          expect(destroyPhoneNumberSpy.callCount).to.eql(1)
        })

        it('unsubscribes the phoneNumber from signald', async () => {
          await destroy({ phoneNumber })
          expect(signaldUnsubscribeStub.callCount).to.eql(1)
        })

        it('returns a success status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            status: 'SUCCESS',
            msg: 'All records of phone number have been destroyed.',
          })
        })
      })

      describe('when notifying members fails', () => {
        beforeEach(async () => {
          destroyPhoneNumberSucceeds()
          destroySignalEntrySucceeds()
          releasePhoneNumberSucceeds()

          findChannelStub.callsFake((_, phoneNumber) =>
            Promise.resolve({
              destroy: destroyChannelSpy,
              phoneNumber,
              memberships: [
                { memberPhoneNumber: '+12223334444', type: 'ADMIN' },
                { memberPhoneNumber: '+15556667777', type: 'ADMIN' },
              ],
            }),
          )

          broadcastMessageStub.onFirstCall().returns(Promise.reject('Failed to broadcast message'))
          broadcastMessageStub.onSecondCall().returns(Promise.resolve())
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message:
              'Failed to destroy channel for +11111111111. Error: Failed to broadcast message',
            status: 'ERROR',
          })
        })
      })

      describe('when destroying the channel in the db fails', () => {
        beforeEach(async () => {
          broadcastMessageSucceeds()
          destroyChannelFails()
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: 'Failed to destroy channel for +11111111111. Error: Failed to destroy channel',
            status: 'ERROR',
          })
        })
      })

      describe('when destroying the phone number in the db fails', () => {
        beforeEach(async () => {
          broadcastMessageSucceeds()
          destroyChannelSucceeds()
          destroyPhoneNumberFails()
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message:
              'Failed to destroy channel for +11111111111. Error: Failed to destroy phoneNumber in db',
            status: 'ERROR',
          })
        })
      })

      describe('when destroying the signal entry data fails', () => {
        beforeEach(async () => {
          destroyPhoneNumberSucceeds()
          releasePhoneNumberSucceeds()
          destroyChannelSucceeds()
          broadcastMessageSucceeds()
          destroySignalEntryFails()
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message:
              'Failed to destroy channel for +11111111111. Error: Failed to destroy signal entry data in keystore',
            status: 'ERROR',
          })
        })
      })

      describe('when releasing the phone number back to twilio fails', () => {
        beforeEach(async () => {
          destroyPhoneNumberSucceeds()
          releasePhoneNumberFails()
          destroyChannelNotCalled()
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message:
              'Failed to destroy channel for +11111111111. Error: Failed to release phone number back to Twilio: {"message":"oh noes!"}',
            status: 'ERROR',
          })
        })
      })

      describe('when unsubscribing from signald fails', () => {
        beforeEach(async () => {
          broadcastMessageSucceeds()
          destroyChannelSucceeds()
          destroyPhoneNumberSucceeds()
          destroySignalEntrySucceeds()
          releasePhoneNumberSucceeds()
          signaldUnsubscribeFails()
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message:
              'Failed to destroy channel for +11111111111. Error: Error: Signald failed to unsubscribe',
            status: 'ERROR',
          })
        })
      })
    })
  })
})
