import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import signal from '../../../../app/services/signal'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { enqueueResend, hash } from '../../../../app/services/dispatcher/resend'
import { wait } from '../../../../app/services/util'
const {
  signal: { minResendInterval, maxResendInterval },
} = require('../../../../app/config')

describe('resend module', () => {
  const sock = {}
  const sdMessage = {
    channel: channelFactory(),
    username: genPhoneNumber(),
    recipientNumber: genPhoneNumber(),
    messageBody: 'foo',
    attachments: ['bar', 'baz'],
  }

  describe('enqueueResend', () => {
    let resendQueue, sendStub
    beforeEach(() => {
      sendStub = sinon.stub(signal, 'sendMessage')
    })
    afterEach(() => {
      sendStub.restore()
    })

    describe('when given a message that has never been resent', () => {
      beforeEach(() => {
        resendQueue = {}
        enqueueResend(sock, resendQueue, sdMessage)
      })

      it('resends the message in resendInverval seconds', async () => {
        expect(sendStub.callCount).to.eql(0)
        await wait(minResendInterval)
        expect(sendStub.callCount).to.eql(1)
      })

      it('it adds the message to the resendQueue', async () => {
        await wait(minResendInterval)
        expect(resendQueue[hash(sdMessage)]).to.eql({
          sdMessage,
          lastResendInterval: minResendInterval,
        })
      })
    })

    describe('given a message that has already been resent', () => {
      beforeEach(() => {
        resendQueue = {
          [hash(sdMessage)]: {
            sdMessage,
            lastResendInterval: minResendInterval,
          },
        }
        enqueueResend(sock, resendQueue, sdMessage)
      })

      it('resends the message in <2 * last resend interval> seconds', async () => {
        await wait(minResendInterval)
        expect(sendStub.callCount).to.eql(0)

        await wait(2 * minResendInterval)
        expect(sendStub.callCount).to.eql(1)
      })

      it("it updates the messages's lastResendInterval in the resendQueue", async () => {
        await wait(2 * minResendInterval)
        expect(resendQueue[hash(sdMessage)]).to.eql({
          sdMessage,
          lastResendInterval: 2 * minResendInterval,
        })
      })
    })

    describe('given a message that has reached the max resend interval threshold', () => {
      beforeEach(() => {
        resendQueue = {
          [hash(sdMessage)]: {
            sdMessage,
            lastResendInterval: maxResendInterval,
          },
        }
        enqueueResend(sock, resendQueue, sdMessage)
      })

      it('does not resend the message', async () => {
        await wait(2 * maxResendInterval)
        expect(sendStub.callCount).to.eql(0)
      })

      it('it deletes the message from the resend queue', async () => {
        await wait(2 * minResendInterval)
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
