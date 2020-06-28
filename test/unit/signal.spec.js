import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import { keys } from 'lodash'
import { wait } from '../../app/util'
import callbacks from '../../app/signal/callbacks'
import signal, {
  messageTypes,
  parseOutboundAttachment,
  parseVerificationCode,
} from '../../app/signal/signal'
import socket, { signaldEncode } from '../../app/socket'
import { EventEmitter } from 'events'
import { genPhoneNumber } from '../support/factories/phoneNumber'
import { genFingerprint } from '../support/factories/deauthorization'
import { inboundAttachmentFactory, outboundAttachmentFactory } from '../support/factories/sdMessage'
import app from '../../app'
import testApp from '../support/testApp'

describe('signal module', () => {
  describe('sending signald commands', () => {
    const channelPhoneNumber = genPhoneNumber()
    const subscriberNumber = genPhoneNumber()
    const fingerprint = genFingerprint()
    let writeStub

    let sck = new EventEmitter().setMaxListeners(0)
    const emit = async msg => {
      const sock = await app.socketPool.acquire()
      sock.emit('data', JSON.stringify(msg) + '\n')
      app.socketPool.release(sock)
    }
    const emitWithDelay = (delay, msg) => wait(delay).then(() => emit(msg))

    before(async () => await app.run({ ...testApp, signal }))
    beforeEach(async () => (writeStub = sinon.stub(socket, 'write').returns(Promise.resolve())))
    afterEach(async () => sinon.restore())
    after(async () => {
      await wait(10)
      await app.stop()
    })

    it('sends a register command', async () => {
      signal.register(channelPhoneNumber)

      expect(writeStub.getCall(0).args[0]).to.eql({
        type: 'register',
        username: channelPhoneNumber,
      })
    })

    it('sends a verify command', () => {
      signal.verify(channelPhoneNumber, '111-222')

      expect(writeStub.getCall(0).args[0]).to.eql({
        type: 'verify',
        username: channelPhoneNumber,
        code: '111-222',
      })
    })

    it('sends a subscribe command', () => {
      signal.subscribe(channelPhoneNumber)

      expect(writeStub.getCall(0).args[0]).to.eql({
        type: 'subscribe',
        username: channelPhoneNumber,
      })
    })

    it('sends an unsubscribe command', () => {
      signal.unsubscribe(channelPhoneNumber)

      expect(writeStub.getCall(0).args[0]).to.eql({
        type: 'unsubscribe',
        username: channelPhoneNumber,
      })
    })

    it('sends a signal message', async () => {
      const sdMessage = {
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: null,
        messageBody: 'hello world!',
        attachments: [],
      }
      await signal.sendMessage('+12223334444', sdMessage)

      expect(writeStub.getCall(0).args[0]).to.eql({
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: '+12223334444',
        messageBody: 'hello world!',
        attachments: [],
      })
    })

    it('broadcasts a signal message', async () => {
      const sdMessage = {
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: null,
        messageBody: 'hello world!',
        attachments: [],
      }
      const recipients = ['+11111111111', '+12222222222']
      await signal.broadcastMessage(recipients, sdMessage)

      expect(writeStub.getCall(0).args[0]).to.eql({
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: '+11111111111',
        messageBody: 'hello world!',
        attachments: [],
      })

      expect(writeStub.getCall(1).args[0]).to.eql({
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: '+12222222222',
        messageBody: 'hello world!',
        attachments: [],
      })
    })

    describe('trusting an expired fingerprint', () => {
      const trustRequest = {
        type: messageTypes.TRUST,
        username: channelPhoneNumber,
        recipientNumber: subscriberNumber,
        fingerprint,
      }
      const trustResponse = {
        type: messageTypes.TRUSTED_FINGERPRINT,
        data: {
          msg_number: 0,
          message: 'Successfully trusted fingerprint',
          error: true,
          request: trustRequest,
        },
      }

      describe('when trusting fingerprint succeeds', () => {
        it('returns a success object', async () => {
          const promises = await Promise.all([
            signal.trust(channelPhoneNumber, subscriberNumber, fingerprint),
            emitWithDelay(10, trustResponse),
          ])
          const result = promises[0]

          expect(result).to.eql({
            status: 'SUCCESS',
            message: callbacks.messages.trust.success(channelPhoneNumber, subscriberNumber),
          })
        })
      })

      describe('when trust request times out', () => {
        it('rejects with an error object', async () => {
          const result = await signal
            .trust(channelPhoneNumber, subscriberNumber, fingerprint)
            .catch(a => a)
          expect(result).to.eql({
            status: 'ERROR',
            message: callbacks.messages.timeout(messageTypes.TRUST),
          })
        })
      })
    })

    xdescribe('listening for a registration verification event', () => {
      const phoneNumber = genPhoneNumber()
      let result

      describe('when a verification success message for the listening channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            app.sck.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_SUCCESS,
                data: { username: phoneNumber },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(phoneNumber)
        })

        it('resolves with the success message', async () => {
          expect(result).to.eql({ username: phoneNumber })
        })
      })

      describe('when a verification failure message for the listening channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            app.sck.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_ERROR,
                data: { username: phoneNumber },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(phoneNumber).catch(a => a)
        })

        it('rejects with an error message', async () => {
          expect(result).to.be.an('Error')
          expect(result.message).to.eql(signal.messages.error.verificationTimeout(phoneNumber))
        })
      })

      describe('when no verification message is emitted before the timeout threshold', () => {
        beforeEach(async () => {
          wait(5).then(() => app.sck.emit('data', JSON.stringify({ type: 'foo' })))
          result = await signal.awaitVerificationResult(phoneNumber).catch(a => a)
        })

        it('rejects with an error message', async () => {
          expect(result).to.be.an('Error')
          expect(result.message).to.eql(signal.messages.error.verificationTimeout(phoneNumber))
        })
      })

      describe('when a verification success message for another channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            app.sck.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_ERROR,
                data: { username: genPhoneNumber() },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(phoneNumber).catch(a => a)
        })

        it('does nothing', () => {
          expect(result).to.be.an('Error')
        })
      })
    })

    xdescribe('checking aliveness of signald', () => {
      it('sends correct object to signald', async () => {
        emitWithDelay(5, {
          type: signal.messageTypes.VERSION,
          data: { version: '+git2020-04-05rd709c3fa.0' },
        })
        await signal.isAlive(sck)
        expect(writeStub.getCall(0).args[0]).to.eql({ type: 'version' })
      })

      it('returns error if signald times out', async () => {
        const response = await signal.isAlive(sck).catch(a => a)
        expect(response).to.eql({ status: 'ERROR' })
      })

      it('returns success if signald responds with version', async () => {
        emitWithDelay(5, {
          type: signal.messageTypes.VERSION,
          data: { version: '+git2020-04-05rd709c3fa.0' },
        })
        const response = await signal.isAlive(sck)
        expect(response).to.eql({ status: 'SUCCESS' })
      })
    })
  })

  describe('message parsing', () => {
    const channelPhoneNumber = genPhoneNumber()
    const adminPhoneNumber = genPhoneNumber()
    const subscriberPhoneNumber = genPhoneNumber()

    it('parses an output signald message from an inbound signald message', () => {
      const inMessage = {
        type: messageTypes.MESSAGE,
        data: {
          username: channelPhoneNumber,
          hasUuid: false,
          hasSource: true,
          source: adminPhoneNumber,
          hasSourceDevice: true,
          sourceDevice: 1,
          type: 1,
          hasRelay: false,
          timestamp: 1556592441767,
          timestampISO: '2019-04-30T02:47:21.767Z',
          serverTimestamp: 1556592443934,
          hasLegacyMessage: false,
          hasContent: true,
          isSignalMessage: false,
          isPrekeySignalMessage: false,
          isReceipt: false,
          isUnidentifiedSender: false,
          dataMessage: {
            timestamp: 1556592441767,
            message: 'hello world!',
            expiresInSeconds: 0,
            attachments: [inboundAttachmentFactory()],
          },
        },
      }
      expect(signal.parseOutboundSdMessage(inMessage)).to.eql({
        type: messageTypes.SEND,
        username: channelPhoneNumber,
        recipientNumber: undefined,
        messageBody: 'hello world!',
        attachments: [outboundAttachmentFactory()],
      })
    })

    it('transforms a resend request message successfully', () => {
      const resendRequestMessage = {
        type: messageTypes.SEND,
        username: channelPhoneNumber,
        recipientNumber: subscriberPhoneNumber,
        messageBody: 'hello world!',
        attachments: [inboundAttachmentFactory()],
      }

      expect(signal.parseOutboundSdMessage(resendRequestMessage)).to.eql({
        type: messageTypes.SEND,
        username: channelPhoneNumber,
        recipientNumber: subscriberPhoneNumber,
        messageBody: 'hello world!',
        attachments: [outboundAttachmentFactory()],
      })
    })

    describe('parsing the filename for an outbound message attachment', () => {
      const inboundAttachment = inboundAttachmentFactory()

      it('keeps the width, height, and voiceNote fields', () => {
        expect(keys(parseOutboundAttachment(inboundAttachment))).to.eql([
          'filename',
          'width',
          'height',
          'voiceNote',
        ])
      })

      it('discards all other fields', () => {
        const members = keys(parseOutboundAttachment(inboundAttachment))
        ;['contentType', 'id', 'size', 'preview', 'key', 'digest'].forEach(member =>
          expect(members).not.to.include(member),
        )
      })

      it('parses a filename from a storedFilename', () => {
        expect(signal.parseOutboundAttachment(inboundAttachment).filename).to.eql(
          inboundAttachment.storedFilename,
        )
      })

      it('parses a filename from a filename', () => {
        expect(
          signal.parseOutboundAttachment({
            ...inboundAttachment,
            storedFilename: undefined,
            filename: 'bar',
          }).filename,
        ).to.eql('bar')
      })

      it('parses an empty string if neither storedFilename or filename found', () => {
        expect(
          signal.parseOutboundAttachment({
            ...inboundAttachment,
            storedFilename: undefined,
          }).filename,
        ).to.eql('')
      })
    })

    describe('parsing sms messages from twilio', () => {
      it('parses a signal verification code from an sms message', () => {
        expect(parseVerificationCode('Your Signal verification code: 123-456')).to.eql([
          true,
          '123-456',
        ])
      })

      it('returns an error from an sms message that is not a verification code', () => {
        expect(parseVerificationCode('JOIN')).to.eql([false, 'JOIN'])
      })
    })
  })
})
