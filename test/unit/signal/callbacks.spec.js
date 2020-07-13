import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import util from '../../../app/util'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { messageTypes } from '../../../app/signal/constants'
import { statuses } from '../../../app/util'
import callbacks from '../../../app/signal/callbacks'
import metrics from '../../../app/metrics'
import membershipRepository, { memberTypes } from '../../../app/db/repositories/membership'
import safetyNumbers from '../../../app/registrar/safetyNumbers'
import { outboundAttachmentFactory } from '../../support/factories/sdMessage'
import { sdMessageOf } from '../../../app/signal/constants'
import moment from 'moment'
const {
  signal: { signaldRequestTimeout, signaldSendTimeout },
} = require('../../../app/config')

describe('callback registry', () => {
  const channelPhoneNumber = genPhoneNumber()
  const subscriberNumber = genPhoneNumber()
  const memberPhoneNumber = genPhoneNumber()
  const attachments = [outboundAttachmentFactory()]
  const fingerprint =
    '05 45 8d 63 1c c4 14 55 bf 6d 24 9f ec cb af f5 8d e4 c8 d2 78 43 3c 74 8d 52 61 c4 4a e7 2c 3d 53'
  const encodedFingerprint =
    '(byte)0x05, (byte)0x45, (byte)0x8d, (byte)0x63, (byte)0x1c, (byte)0xc4, (byte)0x14, (byte)0x55, (byte)0xbf, (byte)0x6d, (byte)0x24, (byte)0x9f, (byte)0xec, (byte)0xcb, (byte)0xaf, (byte)0xf5, (byte)0x8d, (byte)0xe4, (byte)0xc8, (byte)0xd2, (byte)0x78, (byte)0x43, (byte)0x3c, (byte)0x74, (byte)0x8d, (byte)0x52, (byte)0x61, (byte)0xc4, (byte)0x4a, (byte)0xe7, (byte)0x2c, (byte)0x3d, (byte)0x53'
  const messageBody = '[foo]\nbar'
  const id = util.genUuid()

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
        callbacks.register({
          messageType: messageTypes.TRUST,
          id,
          resolve: resolveStub,
          reject: rejectStub,
        })
        expect(callbacks.registry[`${messageTypes.TRUST}-${id}`]).to.eql({
          callback: callbacks._handleTrustResponse,
          resolve: resolveStub,
          reject: rejectStub,
          state: undefined,
        })
      })
      it('rejects and deletes the handler after a timeout', async () => {
        callbacks.register({
          messageType: messageTypes.TRUST,
          id,
          resolve: resolveStub,
          reject: rejectStub,
        })
        await util.wait(signaldRequestTimeout)
        expect(rejectStub.callCount).to.eql(1)
        expect(callbacks.registry[`${messageTypes.TRUST}-${id}`]).to.eql(undefined)
      })
    })

    describe('for a VERIFY request', () => {
      it('registers a VERIFY response handler', () => {
        callbacks.register({
          messageType: messageTypes.VERIFY,
          id: channelPhoneNumber,
          resolve: resolveStub,
          reject: rejectStub,
        })
        expect(callbacks.registry[`${messageTypes.VERIFY}-${channelPhoneNumber}`]).to.eql({
          callback: callbacks._handleVerifyResponse,
          resolve: resolveStub,
          reject: rejectStub,
          state: undefined,
        })
      })
      it('rejects and deletes the handler after timeout', async () => {
        callbacks.register({
          messageTypes: messageTypes.VERIFY,
          id: channelPhoneNumber,
          resolve: resolveStub,
          reject: rejectStub,
        })
        await util.wait(signaldRequestTimeout)
        expect(rejectStub.callCount).to.eql(1)
        expect(callbacks.registry[`${messageTypes.VERIFY}-${channelPhoneNumber}`]).to.eql(undefined)
      })
    })
    describe('for a SEND request', () => {
      it('registers a SEND_RESULT response handler', () => {
        callbacks.register({
          id,
          messageType: messageTypes.SEND,
          state: { channelPhoneNumber, messageBody, attachments },
        })
        expect(callbacks.registry[`${messageTypes.SEND}-${id}`]).to.eql({
          callback: callbacks._handleSendResponse,
          resolve: undefined,
          reject: undefined,
          state: { channelPhoneNumber, messageBody, attachments },
        })
      })
      it('deletes the handler after a timeout', async () => {
        callbacks.register({
          id,
          messageType: messageTypes.SEND,
          state: { channelPhoneNumber, messageBody, attachments },
        })
        await util.wait(signaldSendTimeout)
        expect(callbacks.registry[`${messageTypes.SEND}-${id}`]).to.eql(undefined)
      })
    })
  })

  describe('handling responses', () => {
    describe('a TRUST response', () => {
      const trustResponse = {
        id,
        type: messageTypes.TRUSTED_FINGERPRINT,
        data: {
          msg_number: 0,
          message: 'Successfully trusted fingerprint',
          error: true,
          request: {
            type: messageTypes.TRUST,
            username: channelPhoneNumber,
            recipientAddress: { number: subscriberNumber },
            fingerprint,
          },
        },
      }

      describe('that has been registered', () => {
        it('resolves the TRUST response handler', () => {
          callbacks.register({
            id,
            messageType: messageTypes.TRUST,
            resolve: resolveStub,
            reject: rejectStub,
          })
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
        id,
        type: messageTypes.VERIFICATION_SUCCESS,
        data: { username: channelPhoneNumber },
      }
      const verifyErrorResponse = {
        id,
        type: messageTypes.VERIFICATION_ERROR,
        data: { username: channelPhoneNumber },
      }

      describe('when verification succeeded', () => {
        it('resolves the VERIFY response handler', () => {
          callbacks.register({
            messageType: messageTypes.VERIFY,
            id: channelPhoneNumber,
            resolve: resolveStub,
            reject: rejectStub,
          })
          callbacks.handle(verifySuccessResponse)
          expect(resolveStub.callCount).to.eql(1)
        })
      })
      describe('when verification failed', () => {
        it('rejects the VERIFY response handler', () => {
          callbacks.register({
            messageType: messageTypes.VERIFY,
            id: channelPhoneNumber,
            resolve: resolveStub,
            reject: rejectStub,
          })
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

    describe('a SEND response', () => {
      const whenSent = new Date(
        moment()
          .subtract(1, 'hour')
          .toISOString(),
      ).getTime()
      const whenReceived = new Date().getTime()
      const state = { channelPhoneNumber, messageBody, attachments, whenSent }

      describe('for successfully sent message', () => {
        const successfulSend = {
          id,
          type: messageTypes.SEND_RESULTS,
          data: [
            {
              address: { number: memberPhoneNumber },
              success: { unidentified: false, needsSync: true },
              networkFailure: false,
              unregisteredFailure: false,
            },
          ],
        }

        let setGaugeStub, observeHistogramStub
        beforeEach(() => {
          setGaugeStub = sinon.stub(metrics, 'setGauge').returns(null)
          observeHistogramStub = sinon.stub(metrics, 'observeHistogram').returns(null)
          sinon.stub(util, 'nowInMillis').returns(whenReceived)
          callbacks.register({ messageType: messageTypes.SEND, id, state })
        })

        it('deletes the registry entry', () => {
          callbacks.handle(successfulSend)
          expect(callbacks.registry[`${messageTypes.SEND}-${id}`]).to.eql(undefined)
        })

        it('measures message lag', () => {
          callbacks.handle(successfulSend)
          expect(setGaugeStub.getCall(0).args).to.eql([
            metrics.gauges.MESSAGE_ROUNDTRIP,
            whenReceived - whenSent,
            [state.channelPhoneNumber],
          ])
          expect(observeHistogramStub.getCall(0).args).to.eql([
            metrics.histograms.MESSAGE_ROUNDTRIP,
            whenReceived - whenSent,
            [state.channelPhoneNumber],
          ])
        })
      })

      describe('when SEND_RESULT is an identity failure', () => {
        const successStatus = { status: statuses.SUCCESS, message: 'yay!' }

        const updatableFingerprint = {
          channelPhoneNumber,
          memberPhoneNumber,
          fingerprint,
          sdMessage: sdMessageOf({ phoneNumber: channelPhoneNumber }, messageBody),
        }

        const identityFailureResponse = {
          id,
          type: messageTypes.SEND_RESULTS,
          data: [
            {
              address: { number: memberPhoneNumber },
              networkFailure: false,
              unregisteredFailure: false,
              identityFailure: encodedFingerprint,
            },
          ],
        }

        let resolveMemberTypeStub, trustAndResendStub, deauthorizeStub
        beforeEach(() => {
          resolveMemberTypeStub = sinon.stub(membershipRepository, 'resolveMemberType')
          trustAndResendStub = sinon.stub(safetyNumbers, 'trustAndResend')
          deauthorizeStub = sinon.stub(safetyNumbers, 'deauthorize')
        })

        describe('and intended recipient was an ADMIN', () => {
          beforeEach(async () => {
            resolveMemberTypeStub.returns(Promise.resolve(memberTypes.ADMIN))
            deauthorizeStub.returns(Promise.resolve(successStatus))
          })

          it('deauthorizes the fingerprint', async () => {
            callbacks.register({ messageType: messageTypes.SEND, id, state })
            await callbacks.handle(identityFailureResponse)

            expect(trustAndResendStub.callCount).to.eql(0) // does not attempt to resend
            expect(deauthorizeStub.getCall(0).args[0]).to.eql(updatableFingerprint)
          })
        })

        describe('and intended recipient was a SUBSCRIBER ', () => {
          beforeEach(async () => {
            resolveMemberTypeStub.returns(Promise.resolve(memberTypes.SUBSCRIBER))
            deauthorizeStub.returns(Promise.resolve(successStatus))
          })

          it('trusts the fingerprint and resends the message', async () => {
            callbacks.register({ messageType: messageTypes.SEND, id, state })
            await callbacks.handle(identityFailureResponse)

            expect(deauthorizeStub.callCount).to.eql(0) // does not attempt to deauthorize
            expect(trustAndResendStub.getCall(0).args[0]).to.eql(updatableFingerprint)
          })
        })
        describe('and intended recipient was a rando', () => {
          beforeEach(async () => {
            resolveMemberTypeStub.returns(Promise.resolve(memberTypes.NONE))
          })
          it('does nothing', () => {
            expect(deauthorizeStub.callCount).to.eql(0)
            expect(trustAndResendStub.callCount).to.eql(0)
          })
        })
      })
    })
  })

  describe('a random message', () => {
    it('invokes noop', () => {
      callbacks.handle({ type: 'foo' })
      callbacks.handle({ foo: 'bar' })
      expect(noopStub.callCount).to.eql(2)
    })
  })
})
