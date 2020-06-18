import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import fs from 'fs-extra'
import net from 'net'
import { keys } from 'lodash'
import { wait } from '../../../app/services/util'
import signal, {
  messageTypes,
  parseOutboundAttachment,
  parseVerificationCode,
  pool,
} from '../../../app/services/signal'
import { EventEmitter } from 'events'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { genFingerprint } from '../../support/factories/deauthorization'
import {
  inboundAttachmentFactory,
  outboundAttachmentFactory,
} from '../../support/factories/sdMessage'

describe('signal module', () => {
  const sock = new EventEmitter()
  sock.setEncoding = () => null

  describe('getting a socket', () => {
    let pathExistsStub, connectStub

    beforeEach(() => {
      pathExistsStub = sinon.stub(fs, 'pathExists')
      connectStub = sinon.stub(net, 'createConnection').returns(sock)
    })

    afterEach(() => {
      sinon.restore()
    })

    describe('when socket is eventually available', () => {
      let result
      beforeEach(async () => {
        pathExistsStub.onCall(0).returns(Promise.resolve(false))
        pathExistsStub.onCall(1).returns(Promise.resolve(false))
        pathExistsStub.onCall(2).callsFake(() => {
          wait(5).then(() => sock.emit('connect', sock))
          return Promise.resolve(true)
        })
        result = await signal.getSocket()
      })

      it('looks for a socket descriptor at an interval', async () => {
        expect(pathExistsStub.callCount).to.eql(3)
      })

      it('connects to socket once it exists', () => {
        expect(connectStub.callCount).to.eql(1)
      })

      it('returns the connected socket', () => {
        expect(result).to.eql(sock)
      })
    })

    describe('when connection is never available', () => {
      beforeEach(() => pathExistsStub.returns(Promise.resolve(false)))

      it('attempts to connect a finite number of times then rejects', async () => {
        const result = await signal.getSocket().catch(a => a)
        expect(pathExistsStub.callCount).to.be.above(10)
        expect(connectStub.callCount).to.eql(0)
        expect(result.message).to.eql(signal.messages.error.socketTimeout)
      })
    })
  })

  describe('sending signald commands', () => {
    const channelPhoneNumber = genPhoneNumber()
    const subscriberNumber = genPhoneNumber()
    const fingerprint = genFingerprint()

    let sock
    const emit = msg => sock.emit('data', JSON.stringify(msg) + '\n')
    const emitWithDelay = (delay, msg) => wait(delay).then(() => emit(msg))

    beforeEach(() => {
      sock = new EventEmitter()
      sock.write = sinon.stub().returns(Promise.resolve())
      sinon.stub(pool, 'acquire').returns(Promise.resolve(sock))
      sinon.stub(pool, 'release')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('sends a register command', async () => {
      signal.register(sock, channelPhoneNumber)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"register","username":"${channelPhoneNumber}"}\n`,
      )
    })

    it('sends a verify command', () => {
      signal.verify(sock, channelPhoneNumber, '111-222')

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"verify","username":"${channelPhoneNumber}","code":"111-222"}\n`,
      )
    })

    it('sends a subscribe command', () => {
      signal.subscribe(sock, channelPhoneNumber)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"subscribe","username":"${channelPhoneNumber}"}\n`,
      )
    })

    it('sends an unsubscribe command', () => {
      signal.unsubscribe(sock, channelPhoneNumber)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"unsubscribe","username":"${channelPhoneNumber}"}\n`,
      )
    })

    it('sends a signal message', async () => {
      const sdMessage = {
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: null,
        messageBody: 'hello world!',
        attachments: [],
      }
      await signal.sendMessage(sock, '+12223334444', sdMessage)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+12223334444","messageBody":"hello world!","attachments":[]}\n`,
      )
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
      await signal.broadcastMessage(sock, recipients, sdMessage)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+11111111111","messageBody":"hello world!","attachments":[]}\n`,
      )

      expect(sock.write.getCall(1).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+12222222222","messageBody":"hello world!","attachments":[]}\n`,
      )
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

      it('attempts to trust the new fingerprint', async () => {
        await signal.trust(sock, channelPhoneNumber, subscriberNumber, fingerprint).catch(a => a)
        expect(sock.write.getCall(0).args[0]).to.eql(signal.signaldEncode(trustRequest))
      })

      describe('when trusting fingerprint succeeds', () => {
        it('returns a success object', async () => {
          const promises = await Promise.all([
            signal.trust(sock, channelPhoneNumber, subscriberNumber, fingerprint),
            emitWithDelay(10, trustResponse),
          ])
          const result = promises[0]

          expect(result).to.eql({
            status: 'SUCCESS',
            message: signal.messages.trust.success(channelPhoneNumber, subscriberNumber),
          })
        })
      })

      describe('when trust request times out', () => {
        it('rejects with an error object', async () => {
          const result = await signal
            .trust(sock, channelPhoneNumber, subscriberNumber, fingerprint)
            .catch(a => a)
          expect(result).to.eql({
            status: 'ERROR',
            message: signal.messages.error.trustTimeout(channelPhoneNumber, subscriberNumber),
          })
        })
      })
    })

    describe('listening for a registration verification event', () => {
      const phoneNumber = genPhoneNumber()
      let result

      describe('when a verification success message for the listening channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            sock.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_SUCCESS,
                data: { username: phoneNumber },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(sock, phoneNumber)
        })

        it('resolves with the success message', async () => {
          expect(result).to.eql({ username: phoneNumber })
        })
      })

      describe('when a verification failure message for the listening channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            sock.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_ERROR,
                data: { username: phoneNumber },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(sock, phoneNumber).catch(a => a)
        })

        it('rejects with an error message', async () => {
          expect(result).to.be.an('Error')
          expect(result.message).to.eql(signal.messages.error.verificationTimeout(phoneNumber))
        })
      })

      describe('when no verification message is emitted before the timeout threshold', () => {
        beforeEach(async () => {
          wait(5).then(() => sock.emit('data', JSON.stringify({ type: 'foo' })))
          result = await signal.awaitVerificationResult(sock, phoneNumber).catch(a => a)
        })

        it('rejects with an error message', async () => {
          expect(result).to.be.an('Error')
          expect(result.message).to.eql(signal.messages.error.verificationTimeout(phoneNumber))
        })
      })

      describe('when a verification success message for another channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            sock.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_ERROR,
                data: { username: genPhoneNumber() },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(sock, phoneNumber).catch(a => a)
        })

        it('does nothing', () => {
          expect(result).to.be.an('Error')
        })
      })
    })

    describe('checking aliveness of signald', () => {
      it('sends correct object to signald', async () => {
        emitWithDelay(5, {
          type: signal.messageTypes.VERSION,
          data: { version: '+git2020-04-05rd709c3fa.0' },
        })
        await signal.isAlive(sock)
        expect(sock.write.getCall(0).args[0]).to.eql(`{"type":"version"}\n`)
      })

      it('returns error if signald times out', async () => {
        const response = await signal.isAlive(sock).catch(a => a)
        expect(response).to.eql({ status: 'ERROR' })
      })

      it('returns success if signald responds with version', async () => {
        emitWithDelay(5, {
          type: signal.messageTypes.VERSION,
          data: { version: '+git2020-04-05rd709c3fa.0' },
        })
        const response = await signal.isAlive(sock)
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
