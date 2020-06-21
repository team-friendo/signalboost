import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import { genPhoneNumber } from '../../../../support/factories/phoneNumber'
import { handleSms, reachedQuotaError } from '../../../../../app/services/registrar/phoneNumber/sms'
import { statuses } from '../../../../../app/services/util'
import registrationService from '../../../../../app/services/registrar/phoneNumber/register'
import smsSenderRepository from '../../../../../app/db/repositories/smsSender'
import { smsSenderFactory } from '../../../../support/factories/smsSender'
import { languages } from '../../../../../app/services/language'
import { messagesIn } from '../../../../../app/services/dispatcher/strings/messages'

describe('sms module', () => {
  const phoneNumber = genPhoneNumber()
  const senderPhoneNumber = genPhoneNumber()

  let verifyStub, hasReachedQuotaStub, countMessageStub
  beforeEach(() => {
    verifyStub = sinon.stub(registrationService, 'verify')
    hasReachedQuotaStub = sinon.stub(smsSenderRepository, 'hasReachedQuota')
    countMessageStub = sinon
      .stub(smsSenderRepository, 'countMessage')
      .returns(Promise.resolve(smsSenderFactory()))
  })
  afterEach(() => {
    sinon.restore()
  })

  describe('handleInboundSms', () => {
    describe('when sms is a signal verification code', () => {
      const verificationCode = '809-842'
      const message = `Your Signal verification code: ${verificationCode} for +14322239406`

      describe('in all cases', () => {
        let callCount
        beforeEach(() => {
          callCount = verifyStub.callCount
          verifyStub.returns(Promise.resolve())
        })
        it('attempts to verify the code', async () => {
          await handleSms({ phoneNumber, senderPhoneNumber, message })
          expect(verifyStub.callCount).to.be.above(callCount)
          expect(verifyStub.getCall(0).args[0]).to.eql({ phoneNumber, verificationCode })
        })
      })

      describe('when verification succeeds', () => {
        const successStatus = { status: statuses.SUCCESS, message: 'OK' }
        beforeEach(() => verifyStub.returns(Promise.resolve(successStatus)))

        it('returns a success status', async () => {
          expect(await handleSms({ phoneNumber, senderPhoneNumber, message })).to.eql(successStatus)
        })
      })

      describe('when verification fails', () => {
        const errorStatus = { status: statuses.SUCCESS, message: 'OK' }
        beforeEach(() => verifyStub.returns(Promise.resolve(errorStatus)))

        it('returns an error status', async () => {
          expect(await handleSms({ phoneNumber, senderPhoneNumber, message })).to.eql(errorStatus)
        })
      })
    })
  })

  describe('when sms is a random message from a user', () => {
    const message = 'HELLO! How does this work???'
    let verifyCallCount, countMessageCallCount, result

    beforeEach(async () => {
      verifyCallCount = verifyStub.callCount
      countMessageCallCount = countMessageStub.callCount
    })

    afterEach(() => {
      sinon.restore()
    })

    describe('in all cases', () => {
      beforeEach(() => handleSms({ phoneNumber, senderPhoneNumber, message }))

      it('does not attempt to verify code', () => {
        expect(verifyStub.callCount).to.eql(verifyCallCount)
      })
    })

    describe('when user has not reached quota', () => {
      const frenchPhoneNumber = '+32494000000'
      beforeEach(async () => {
        hasReachedQuotaStub.returns(Promise.resolve(false))
        result = await handleSms({
          phoneNumber,
          senderPhoneNumber: frenchPhoneNumber,
          message,
        })
      })

      it('returns a TWIML message with a prompt to install signal', () => {
        const prompt = messagesIn(languages.FR).notifications.promptToUseSignal
        expect(result).to.eql({
          status: statuses.SUCCESS,
          message: `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${prompt}</Message></Response>`,
        })
      })

      it('increments the senders message count', () => {
        expect(countMessageStub.callCount).to.be.above(countMessageCallCount)
      })
    })

    describe('when user has reached quota', () => {
      beforeEach(async () => {
        hasReachedQuotaStub.returns(Promise.resolve(true))
        result = await handleSms({ phoneNumber, senderPhoneNumber, message })
      })

      it('returns an error', () => {
        expect(result).to.eql({
          status: statuses.ERROR,
          message: reachedQuotaError,
        })
      })

      it('does not increment the senders message count', () => {
        expect(countMessageStub.callCount).to.eql(countMessageCallCount)
      })
    })

    describe('when there is a database errror', () => {
      beforeEach(async () => {
        hasReachedQuotaStub.callsFake(() => Promise.reject(new Error('oh noes!')))
        result = await handleSms({ phoneNumber, senderPhoneNumber, message }).catch(e => e)
      })

      it('returns an error', () => {
        expect(result).to.eql({
          status: statuses.ERROR,
          message: 'Database error: Error: oh noes!',
        })
      })
    })
  })
})
