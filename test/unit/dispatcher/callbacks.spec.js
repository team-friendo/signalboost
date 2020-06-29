import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import util from '../../../app/util'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { messageTypes } from '../../../app/signal/signal'
import { statuses } from '../../../app/util'
import { genFingerprint } from '../../support/factories/deauthorization'
import callbacks from '../../../app/signal/callbacks'
const {
  signal: { signaldRequestTimeout },
} = require('../../../app/config')

describe('callback registry', () => {
  const channelPhoneNumber = genPhoneNumber()
  const subscriberNumber = genPhoneNumber()

  const fingerprint = genFingerprint()

  let resolveStub, rejectStub, noopStub
  beforeEach(() => {
    resolveStub = sinon.stub()
    rejectStub = sinon.stub()
    noopStub = sinon.stub(util, 'noop')
  })
  afterEach(() => {
    callbacks.clear()
    sinon.restore()
  })

  describe('registering callbacks', () => {
    describe('for a TRUST request', () => {
      it('registers a TRUST response handler', () => {
        callbacks.register(messageTypes.TRUST, fingerprint, resolveStub, rejectStub)
        expect(callbacks.registry[`${messageTypes.TRUST}-${fingerprint}`]).to.eql({
          callback: callbacks._handleTrustResponse,
          resolve: resolveStub,
          reject: rejectStub,
        })
      })
      it('rejects and deletes teh handler after a timeout', async () => {
        callbacks.register(messageTypes.TRUST, fingerprint, resolveStub, rejectStub)
        await util.wait(signaldRequestTimeout)
        expect(rejectStub.callCount).to.eql(1)
        expect(callbacks.registry[`${messageTypes.TRUST}-${fingerprint}`]).to.eql(undefined)
      })
    })

    describe('for a VERIFY request', () => {
      it('registers a VERIFY response handler', () => {
        callbacks.register(messageTypes.VERIFY, channelPhoneNumber, resolveStub, rejectStub)
        expect(callbacks.registry[`${messageTypes.VERIFY}-${channelPhoneNumber}`]).to.eql({
          callback: callbacks._handleVerifyResponse,
          resolve: resolveStub,
          reject: rejectStub,
        })
      })
      it('rejects and deletes the handler after timeout', async () => {
        callbacks.register(messageTypes.VERIFY, channelPhoneNumber, resolveStub, rejectStub)
        await util.wait(signaldRequestTimeout)
        expect(rejectStub.callCount).to.eql(1)
        expect(callbacks.registry[`${messageTypes.VERIFY}-${channelPhoneNumber}`]).to.eql(undefined)
      })
    })
  })

  describe('handling responses', () => {
    describe('a TRUST reponse', () => {
      const trustResponse = {
        type: messageTypes.TRUSTED_FINGERPRINT,
        data: {
          msg_number: 0,
          message: 'Successfully trusted fingerprint',
          error: true,
          request: {
            type: messageTypes.TRUST,
            username: channelPhoneNumber,
            recipientNumber: subscriberNumber,
            fingerprint,
          },
        },
      }

      describe('that has been registered', () => {
        it('resolves the TRUST response handler', () => {
          callbacks.register(messageTypes.TRUST, fingerprint, resolveStub, rejectStub)
          callbacks.handle(trustResponse)
          expect(resolveStub.getCall(0).args[0]).to.eql({
            status: statuses.SUCCESS,
            message: callbacks.messages.trust.success(channelPhoneNumber, subscriberNumber),
          })
        })
      })

      describe('that has not been registered', () => {
        it('invokes noop', async () => {
          callbacks.handle(trustResponse)
          expect(noopStub.callCount).to.eql(1)
        })
      })
    })

    describe('a VERIFY response', () => {
      const verifySuccessResponse = {
        type: messageTypes.VERIFICATION_SUCCESS,
        data: { username: channelPhoneNumber },
      }
      const verifyErrorResponse = {
        type: messageTypes.VERIFICATION_ERROR,
        data: { username: channelPhoneNumber },
      }

      describe('when verification succeeded', () => {
        it('resolves the VERIFY response handler', () => {
          callbacks.register(messageTypes.VERIFY, channelPhoneNumber, resolveStub, rejectStub)
          callbacks.handle(verifySuccessResponse)
          expect(resolveStub.callCount).to.eql(1)
        })
      })
      describe('when verification failed', () => {
        it('rejects the VERIFY response handler', () => {
          callbacks.register(messageTypes.VERIFY, channelPhoneNumber, resolveStub, rejectStub)
          callbacks.handle(verifyErrorResponse)
          expect(rejectStub.getCall(0).args[0]).to.be.an('Error')
        })
      })
      describe('when verification was not registered', () => {
        it('invokes noop', () => {
          callbacks.handle(verifySuccessResponse)
          callbacks.handle(verifyErrorResponse)
          expect(noopStub.callCount).to.eql(2)
        })
      })
    })
  })

  describe('a random message', () => {
    it('invokes noop', () => {
      callbacks.handle({ type: 'foo' })
      expect(noopStub.callCount).to.eql(1)
    })
  })
})
