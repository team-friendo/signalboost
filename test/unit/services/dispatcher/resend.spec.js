import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import { get, last } from 'lodash'
import signal from '../../../../app/services/signal'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { enqueueResend, hash } from '../../../../app/services/dispatcher/resend'
import { wait } from '../../../../app/services/util'
const {
  signal: { minResendInterval, maxResendInterval },
} = require('../../../../app/config')

describe('resend module', () => {
  const sock = { write: () => Promise.resolve() }
  const sdMessage = {
    channel: channelFactory(),
    username: genPhoneNumber(),
    recipientNumber: genPhoneNumber(),
    messageBody: 'foo',
    attachments: ['bar', 'baz'],
  }

  describe('enqueueResend', () => {
    let resendQueue, sendStub, sendCount, resendInterval
    beforeEach(() => {
      sendStub = sinon.stub(signal, 'sendMessage')
    })
    afterEach(() => {
      sendStub.restore()
    })

    describe('given a message that has never been resent', () => {
      const _sdMessage = { ...sdMessage, messageBody: 'first time' }
      beforeEach(() => {
        sendCount = sendStub.callCount
        resendQueue = {}
        resendInterval = enqueueResend(sock, resendQueue, _sdMessage)
      })

      it('resends the message in minResendInverval seconds', async () => {
        expect(sendStub.callCount).to.eql(sendCount)

        await wait(minResendInterval)
        expect(sendStub.callCount).to.eql(sendCount + 1)
        expect(last(sendStub.getCalls()).args).to.eql([
          sock,
          _sdMessage.recipientNumber,
          _sdMessage,
        ])
      })

      it('it adds the message to the resendQueue', async () => {
        expect(resendQueue[hash(_sdMessage)]).to.eql({
          sdMessage: _sdMessage,
          lastResendInterval: minResendInterval,
        })
      })

      it('returns the resend interval', () => {
        expect(resendInterval).to.eql(minResendInterval)
      })
    })

    describe('given a message that has already been resent', () => {
      const _sdMessage = { ...sdMessage, messageBody: 'second time' }
      beforeEach(() => {
        sendCount = sendStub.callCount
        resendQueue = {
          [hash(_sdMessage)]: {
            sdMessage: _sdMessage,
            lastResendInterval: minResendInterval,
          },
        }
        enqueueResend(sock, resendQueue, _sdMessage)
      })

      it('resends the message in <2 * last resend interval> seconds', async () => {
        expect(sendStub.callCount).to.eql(sendCount)

        await wait(2 * minResendInterval)
        expect(sendStub.callCount).to.be.at.least(sendCount + 1)
        expect(last(sendStub.getCalls()).args).to.eql([
          sock,
          _sdMessage.recipientNumber,
          _sdMessage,
        ])
      })

      it("it updates the messages's lastResendInterval in the resendQueue", async () => {
        expect(resendQueue[hash(_sdMessage)]).to.eql({
          sdMessage: _sdMessage,
          lastResendInterval: 2 * minResendInterval,
        })
      })
    })

    describe('given a message that has reached the max resend interval threshold', () => {
      const _sdMessage = { ...sdMessage, messageBody: 'too many times' }
      beforeEach(() => {
        sendCount = sendStub.callCount
        resendQueue = {
          [hash(_sdMessage)]: {
            sdMessage: _sdMessage,
            lastResendInterval: maxResendInterval,
          },
        }
        enqueueResend(sock, resendQueue, _sdMessage)
      })

      it('does not resend the message', async () => {
        await wait(2 * maxResendInterval)
        expect(get(sendStub.getCall(0), 'args.2')).not.to.eql(_sdMessage)
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
          attachments: ['baz', 'bar'],
        }),
      )
    })
  })
})
