import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
const fs = require('fs-extra')
const net = require('net')
import signal, { messageTypes } from '../../../app/services/signal'
import { genPhoneNumber } from '../../support/factories/phoneNumber'

describe('signal module', () => {
  describe('getting a socket', () => {
    let pathExistsStub, connectStub, exitStub
    beforeEach(() => {
      pathExistsStub = sinon.stub(fs, 'pathExists')
      connectStub = sinon.stub(net, 'createConnection').returns(Promise.resolve())
      exitStub = sinon.stub(process, 'exit')
    })
    afterEach(() => {
      pathExistsStub.restore()
      connectStub.restore()
      exitStub.restore()
    })

    describe('when connection is eventually available', () => {
      beforeEach(() => {
        pathExistsStub.onCall(0).returns(Promise.resolve(false))
        pathExistsStub.onCall(1).returns(Promise.resolve(false))
        pathExistsStub
          .onCall(2)
          .returns(Promise.resolve(true))
          .onCall(2)
      })

      it('looks for a socket descriptor at an interval and connects to it once it exists', async () => {
        await signal.getSocket()
        expect(pathExistsStub.callCount).to.eql(3)
        expect(connectStub.callCount).to.eql(1)
      })
    })

    describe('when connection is never available', () => {
      beforeEach(() => pathExistsStub.returns(Promise.resolve(false)))

      it('attempts to connect a finite number of times then exits', async () => {
        await signal.getSocket()
        expect(pathExistsStub.callCount).to.be.above(10)
        expect(connectStub.callCount).to.eql(0)
        expect(exitStub.callCount).to.eql(1)
      })
    })
  })

  describe('sending signald commands', () => {
    const channelPhoneNumber = genPhoneNumber()
    let sock
    beforeEach(() => (sock = { write: sinon.stub() }))

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

    it('sends a signal message', () => {
      const sdMessage = {
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: '+12223334444',
        messageBody: 'hello world!',
        attachments: [],
      }
      signal.sendMessage(sock, sdMessage)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+12223334444","messageBody":"hello world!","attachments":[]}\n`,
      )
    })

    it('broadcasts a signal message', () => {
      const sdMessage = {
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: null,
        messageBody: 'hello world!',
        attachments: [],
      }
      const recipients = ['+11111111111', '+12222222222']
      signal.broadcastMessage(sock, recipients, sdMessage)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+11111111111","messageBody":"hello world!","attachments":[]}\n`,
      )

      expect(sock.write.getCall(1).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+12222222222","messageBody":"hello world!","attachments":[]}\n`,
      )
    })
  })

  describe('message parsing', () => {
    it('parses an output signald message from an inbound signald message', () => {
      const inMessage = {
        type: messageTypes.MESSAGE,
        data: {
          username: '+14049486063',
          hasUuid: false,
          hasSource: true,
          source: '+18319176400',
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
            attachments: [
              {
                contentType: 'image/jpeg',
                id: 1461823935771385721,
                size: 1756017,
                storedFilename: '/var/lib/signald/attachments/1461823935771385721',
                width: 4032,
                height: 3024,
                voiceNote: false,
                preview: { present: false },
                key:
                  'cpdTsaYm9fsE+T29HtCl8qWW2LZPhM32zy82K4VYjTcsqtCIsRxYivSEnxvP6qHD9VwZPrAjFlzZtw6DYWAiig==',
                digest: 'UYm6uzLlrw2xEezccQtb0jqE4jSDq0+09JvySk+EzrQ=',
              },
            ],
          },
        },
      }
      expect(signal.parseOutboundSdMessage(inMessage)).to.eql({
        type: messageTypes.SEND,
        username: '+14049486063',
        recipientNumber: null,
        messageBody: 'hello world!',
        attachments: [
          {
            filename: '/var/lib/signald/attachments/1461823935771385721',
            width: 4032,
            height: 3024,
            voiceNote: false,
          },
        ],
      })
    })
  })
})
