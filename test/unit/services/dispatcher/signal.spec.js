import { expect } from 'chai'
import { describe, it } from 'mocha'
import signal, { messageTypes } from '../../../../app/services/dispatcher/signal'

describe('signal module', () => {
  describe('message parsing', () => {
    it('parses an SignalBoostMessage from an InMessage', () => {
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
      expect(signal.parseOutMessage(inMessage)).to.eql({
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
