/* eslint-disable no-unused-vars */
import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import commonService from '../../../../../app/services/registrar/phoneNumber/common'
import { destroy } from '../../../../../app/services/registrar/phoneNumber/destroy'
import sinon from 'sinon'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import channelRepository from '../../../../../app/db/repositories/channel'
import signal from '../../../../../app/services/signal'
import app from '../../../../../app'
import testApp from '../../../../support/testApp'
import dbService from '../../../../../app/db'
const fs = require('fs-extra')

describe('phone number services -- destroy module', () => {
  // SETUP
  const phoneNumber = '+11111111111'
  const sock = {}
  let findChannelStub,
    findPhoneNumberStub,
    broadcastMessageStub,
    releasePhoneNumberStub,
    destroyChannelSpy,
    destroyPhoneNumberSpy,
    deleteDirStub,
    twilioRemoveSpy,
    signaldUnsubscribeStub

  const destroyChannelSucceeds = () =>
    findChannelStub.callsFake((_, phoneNumber) =>
      Promise.resolve({
        destroy: destroyChannelSpy,
        phoneNumber,
        memberships: [{ memberPhoneNumber: '+12223334444' }, { memberPhoneNumber: '+15556667777' }],
      }),
    )

  const channelDoesNotExist = () =>
    findChannelStub.callsFake((_, phoneNumber) => Promise.resolve(null))

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
    releasePhoneNumberStub.callsFake(sid => ({
      incomingPhoneNumbers: () => ({ remove: () => twilioRemoveSpy() }),
    }))
  }

  const releasePhoneNumberFails = () => {
    releasePhoneNumberStub.throws()
  }

  const broadcastMessageSucceeds = () =>
    broadcastMessageStub.callsFake(async (phoneNumbers, msg) => await Promise.resolve())

  const broadcastMessageFails = () =>
    broadcastMessageStub.callsFake(
      async (phoneNumbers, msg) => await Promise.reject('Failed to broadcast message'),
    )

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

      describe('when phone number does exist in phone number db', () => {
        beforeEach(async () => {
          await channelDoesNotExist()
          await broadcastMessageSucceeds()
          await destroySignalEntrySucceeds()
          await releasePhoneNumberSucceeds()
          await destroyPhoneNumberSucceeds()
        })

        it('runs successfully', async () => {
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

    describe('when phone numbers do exist in channels db', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve({}))
      })

      describe('all tasks succeed', () => {
        beforeEach(async () => {
          await broadcastMessageSucceeds()
          await destroyChannelSucceeds()
          await destroySignalEntrySucceeds()
          await releasePhoneNumberSucceeds()
          await destroyPhoneNumberSucceeds()
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
          await destroyPhoneNumberSucceeds()
          await destroySignalEntrySucceeds()
          await releasePhoneNumberSucceeds()

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
          await broadcastMessageSucceeds()
          await destroyChannelFails()
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
          await broadcastMessageSucceeds()
          await destroyChannelSucceeds()
          await destroyPhoneNumberFails()
          await destroySignalEntrySucceeds()
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
          await broadcastMessageSucceeds()
          await destroyChannelSucceeds()
          await destroyPhoneNumberSucceeds()
          await destroySignalEntryFails()
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
          await broadcastMessageSucceeds()
          await destroyChannelSucceeds()
          await destroyPhoneNumberSucceeds()
          await destroySignalEntrySucceeds()
          await releasePhoneNumberFails()
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message:
              'Failed to destroy channel for +11111111111. Error: Failed to release phone number back to Twilio',
            status: 'ERROR',
          })
        })
      })

      describe('when unsubscribing from signald fails', () => {
        beforeEach(async () => {
          await broadcastMessageSucceeds()
          await destroyChannelSucceeds()
          await destroyPhoneNumberSucceeds()
          await destroySignalEntrySucceeds()
          await releasePhoneNumberSucceeds()
          await signaldUnsubscribeFails()
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
