import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import util from '../../../app/util'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { messageTypes } from '../../../app/signal/constants'
import { statuses } from '../../../app/util'
import callbacks from '../../../app/signal/callbacks'
import metrics from '../../../app/metrics'
import safetyNumbers from '../../../app/registrar/safetyNumbers'
import { outboundAttachmentFactory } from '../../support/factories/sdMessage'
import { sdMessageOf } from '../../../app/signal/constants'
const {
  signal: {
    diagnosticsPhoneNumber,
    healthcheckTimeout,
    signaldRequestTimeout,
    signaldSendTimeout,
    signaldVerifyTimeout,
  },
} = require('../../../app/config')

describe('callback registry', () => {
  const channelPhoneNumber = genPhoneNumber()
  const subscriberNumber = genPhoneNumber()
  const memberPhoneNumber = genPhoneNumber()
  const attachments = [outboundAttachmentFactory()]
  const fingerprint =
    '05 45 8d 63 1c c4 14 55 bf 6d 24 9f ec cb af f5 8d e4 c8 d2 78 43 3c 74 8d 52 61 c4 4a e7 2c 3d 53'
  const messageBody = '[foo]\nbar'
  const id = util.genUuid()
  const oneMinuteAgoInMillis = new Date().getTime() - 1000 * 60

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
        await util.wait(signaldVerifyTimeout)
        expect(rejectStub.callCount).to.eql(1)
        expect(callbacks.registry[`${messageTypes.VERIFY}-${channelPhoneNumber}`]).to.eql(undefined)
      })
    })
    describe('for a SEND request', () => {
      it('registers a SEND_RESULT response handler', () => {
        callbacks.register({
          id,
          messageType: messageTypes.SEND,
          state: { channelPhoneNumber, messageBody, attachments, whenSent: oneMinuteAgoInMillis },
        })
        expect(callbacks.registry[`${messageTypes.SEND}-${id}`]).to.eql({
          callback: callbacks._handleSendResponse,
          resolve: undefined,
          reject: undefined,
          state: { channelPhoneNumber, messageBody, attachments, whenSent: oneMinuteAgoInMillis },
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

    describe('for a HEALTHCHECK', () => {
      it('registers a HEALTHCHECK response handler', () => {
        callbacks.register({
          messageType: messageTypes.HEALTHCHECK,
          id,
          resolve: resolveStub,
          reject: rejectStub,
          state: { whenSent: oneMinuteAgoInMillis },
        })
        expect(callbacks.registry[`${messageTypes.HEALTHCHECK}-${id}`]).to.eql({
          callback: callbacks._handleHealthcheckResponse,
          resolve: resolveStub,
          reject: rejectStub,
          state: { whenSent: oneMinuteAgoInMillis },
        })
      })

      it('deletes the handler after a timeout', async () => {
        callbacks.register({
          messageType: messageTypes.HEALTHCHECK,
          id,
          resolve: resolveStub,
          reject: rejectStub,
          state: { whenSent: oneMinuteAgoInMillis },
        })
        await util.wait(healthcheckTimeout)
        expect(callbacks.registry[`${messageTypes.HEALTHCHECK}-${id}`]).to.eql(undefined)
      })
    })

    describe('for a VERSION message', () => {
      it('registers a VERSION response handler', () => {
        callbacks.register({
          messageType: messageTypes.VERSION,
          id: 0,
          resolve: resolveStub,
          reject: rejectStub,
        })
        expect(callbacks.registry[`${messageTypes.VERSION}-0`]).to.eql({
          callback: callbacks._handleVersionResponse,
          resolve: resolveStub,
          reject: rejectStub,
          state: undefined,
        })
      })

      it('deletes the handler after a timeout', async () => {
        callbacks.register({
          messageType: messageTypes.VERSION,
          id,
          resolve: resolveStub,
          reject: rejectStub,
        })
        await util.wait(signaldRequestTimeout)
        expect(callbacks.registry[`${messageTypes.VERSION}-0`]).to.eql(undefined)
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
      const whenSent = oneMinuteAgoInMillis
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

        let observeHistogramStub
        beforeEach(() => {
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
          expect(observeHistogramStub.getCall(0).args).to.eql([
            metrics.histograms.MESSAGE_ROUNDTRIP,
            whenReceived - whenSent,
            [state.channelPhoneNumber],
          ])
        })
      })

      describe('when SEND_RESULT is an identity failure', () => {
        const identityFailureResponse = {
          id,
          type: messageTypes.SEND_RESULTS,
          data: [
            {
              address: { number: memberPhoneNumber },
              networkFailure: false,
              unregisteredFailure: false,
              identityFailure: fingerprint,
            },
          ],
        }

        let updateFingerprintStub
        beforeEach(() => (updateFingerprintStub = sinon.stub(safetyNumbers, 'updateFingerprint')))

        it("updates the sender's fingerprint", async () => {
          callbacks.register({ messageType: messageTypes.SEND, id, state })
          await callbacks.handle(identityFailureResponse)

          expect(updateFingerprintStub.getCall(0).args).to.eql([
            {
              channelPhoneNumber,
              memberPhoneNumber,
              fingerprint,
              sdMessage: sdMessageOf({
                sender: channelPhoneNumber,
                message: messageBody,
                recipient: memberPhoneNumber,
              }),
            },
          ])
        })
      })
    })

    describe('a HEALTHCHECK response', () => {
      const healthcheckResponse = {
        type: messageTypes.MESSAGE,
        data: {
          username: diagnosticsPhoneNumber,
          source: {
            number: channelPhoneNumber,
          },
          dataMessage: {
            timestamp: new Date().toISOString(),
            body: `${messageTypes.HEALTHCHECK_RESPONSE} ${id}`,
            expiresInSeconds: 0,
            attachments: [],
          },
        },
      }
      const nowInMillis = new Date().getTime()

      beforeEach(() => {
        sinon.stub(util, 'nowInMillis').returns(nowInMillis)
        callbacks.register({
          messageType: messageTypes.HEALTHCHECK,
          id,
          resolve: resolveStub,
          reject: rejectStub,
          state: { whenSent: oneMinuteAgoInMillis },
        })
      })

      it('resolves a promise with the healthcheck response time in sec', async () => {
        callbacks.handle(healthcheckResponse)
        expect(resolveStub.getCall(0).args).to.eql([(nowInMillis - oneMinuteAgoInMillis) / 1000])
      })

      it('deletes the registry entry', () => {
        callbacks.handle(healthcheckResponse)
        expect(callbacks.registry[`${messageTypes.HEALTHCHECK}-${id}`]).to.eql(undefined)
      })
    })
  })

  describe('a VERSION response', () => {
    const version = '+git2020-10-06r6cf17ecb.0'
    const versionResponse = {
      type: messageTypes.VERSION,
      data: {
        name: 'signald',
        version,
        branch: 'master',
        commit: '6cf17ecb7b82f2ba209a0b9059c7355d88773b78',
      },
    }
    beforeEach(() => {
      callbacks.register({
        id: 42,
        messageType: messageTypes.VERSION,
        resolve: resolveStub,
        reject: rejectStub,
      })
      callbacks.handle(versionResponse, 42)
    })

    it('resolves a promise with the running signald version', () => {
      expect(resolveStub.getCall(0).args).to.eql([version])
    })

    it('deletes the registry entry', () => {
      expect(callbacks.registry[`${messageTypes.VERSION}-0`]).to.eql(undefined)
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
