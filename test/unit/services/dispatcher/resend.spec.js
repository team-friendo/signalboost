import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import { get, last } from 'lodash'
import signal, { parseOutboundAttachment } from '../../../../app/signal'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { enqueueResend, hash } from '../../../../app/dispatcher/resend'
import { wait } from '../../../../app/util'
const {
  signal: { minResendInterval, maxResendInterval },
} = require('../../../../app/config')

describe('resend module', () => {
  const sdMessage = {
    channel: channelFactory(),
    username: genPhoneNumber(),
    recipientNumber: genPhoneNumber(),
    messageBody: 'foo',
    attachments: [
      {
        // including all fields here for documentation purposes
        contentType: 'image/jpeg',
        id: 8471834496431694721,
        size: 3146573,
        storedFilename: '/var/lib/signald/attachments/8471834496431694721',
        width: 3024,
        height: 4032,
        voiceNote: false,
        preview: { present: false },
        key:
          'eil4wxAcA3p3g8Lqllns5HjFM1YL3mcml/X4VKsvjWj7tkIhJ05WE0OkizGDadx3ob0fPID/v52pc5JuAj5dqQ==',
        digest: 'TT0XlSEFzvqqHDEQDoTaKZ3EwXcC83cYCMfMQ/cuM8E=',
        blurhash: 'LYF~N,?bofj[~ps,WVof?aaxWBWB',
      },
      {
        // omitting non-hashed fields
        digest: 'a+2pMS19lPsy26comR7S3sShP7mRHEUnb3xCafDoWEk=',
      },
    ],
  }

  describe('enqueueResend', () => {
    let resendQueue, sendStub, sendCount, resendInterval
    beforeEach(() => {
      sendStub = sinon.stub(signal, 'sendMessage')
    })
    afterEach(() => {
      sinon.restore()
    })

    describe('given a message that has never been resent', () => {
      const inSdMessage = { ...sdMessage, messageBody: 'first time' }
      const outSdMessage = signal.parseOutboundSdMessage(inSdMessage)
      beforeEach(() => {
        sendCount = sendStub.callCount
        resendQueue = {}
        resendInterval = enqueueResend(resendQueue, inSdMessage)
      })

      it('resends the message in minResendInverval seconds', async () => {
        expect(sendStub.callCount).to.eql(sendCount)

        await wait(minResendInterval)
        expect(sendStub.callCount).to.eql(sendCount + 1)
        expect(last(sendStub.getCalls()).args).to.eql([outSdMessage.recipientNumber, outSdMessage])
      })

      it('it adds the message to the resendQueue', async () => {
        expect(resendQueue[hash(inSdMessage)]).to.eql({
          sdMessage: outSdMessage,
          lastResendInterval: minResendInterval,
        })
      })

      it('returns the resend interval', () => {
        expect(resendInterval).to.eql(minResendInterval)
      })
    })

    describe('given a message that has already been resent', () => {
      const outSdMessage = signal.parseOutboundSdMessage({
        ...sdMessage,
        messageBody: 'second time',
      })

      beforeEach(() => {
        sendCount = sendStub.callCount
        resendQueue = {
          [hash(outSdMessage)]: {
            sdMessage: outSdMessage,
            lastResendInterval: minResendInterval,
          },
        }
        enqueueResend(resendQueue, outSdMessage)
      })

      it('resends the message in <2 * last resend interval> seconds', async () => {
        expect(sendStub.callCount).to.eql(sendCount)

        await wait(2 * minResendInterval)
        expect(sendStub.callCount).to.be.at.least(sendCount + 1)
        expect(last(sendStub.getCalls()).args).to.eql([outSdMessage.recipientNumber, outSdMessage])
      })

      it("it updates the messages's lastResendInterval in the resendQueue", async () => {
        expect(resendQueue[hash(outSdMessage)]).to.eql({
          sdMessage: outSdMessage,
          lastResendInterval: 2 * minResendInterval,
        })
      })
    })

    describe('given a message that has reached the max resend interval threshold', () => {
      const outSdMessage = {
        ...sdMessage,
        attachments: sdMessage.attachments.map(parseOutboundAttachment),
        messageBody: 'too many times',
      }

      beforeEach(() => {
        sendCount = sendStub.callCount
        resendQueue = {
          [hash(outSdMessage)]: {
            sdMessage: outSdMessage,
            lastResendInterval: maxResendInterval,
          },
        }
        enqueueResend(resendQueue, outSdMessage)
      })

      it('does not resend the message', async () => {
        await wait(2 * maxResendInterval)
        expect(get(sendStub.getCall(0), 'args.2')).not.to.eql(outSdMessage)
      })

      it('it deletes the message from the resend queue', async () => {
        expect(resendQueue[hash(sdMessage)]).to.eql(undefined)
      })
    })
  })

  describe('#hash', () => {
    it('hashes an sd message into a 20-byte hex string', () => {
      const hashed = hash(sdMessage)
      expect(hashed.length).to.eql(40)
      hashed.split('').forEach(char => expect('0123456789aAbBcCdDeEfF').to.include(char))
    })

    it('produces the same hash for messages with same body, sender, receiver', () => {
      expect(hash(sdMessage)).to.equal(hash(sdMessage))
    })

    it('produces the same hash for equivalent inbound and outbound messages', () => {
      expect(hash(sdMessage)).to.equal(
        hash({ ...sdMessage, attachments: sdMessage.attachments.map(parseOutboundAttachment) }),
      )
    })

    it('produces the different hash for different body', () => {
      expect(hash(sdMessage)).not.to.equal(
        hash({
          ...sdMessage,
          messageBody: 'bazinga',
        }),
      )
    })

    it('produces the different hash for different sender (channel number)', () => {
      expect(hash(sdMessage)).not.to.equal(
        hash({
          ...sdMessage,
          username: 'bazinga',
        }),
      )
    })

    it('produces the different hash for different receiver', () => {
      expect(hash(sdMessage)).not.to.equal(
        hash({
          ...sdMessage,
          recipientNumber: 'bazinga',
        }),
      )
    })

    it('produces the different hash for different attachments', () => {
      expect(hash(sdMessage)).not.to.equal(
        hash({
          ...sdMessage,
          attachments: [{ digest: 'foo' }],
        }),
      )
    })
  })
})
