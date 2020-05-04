import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import { genPhoneNumber } from '../../../../support/factories/phoneNumber'
import { EventEmitter } from 'events'
import { handleSms } from '../../../../../app/services/registrar/phoneNumber/sms'
import { statuses } from '../../../../../app/constants'
import registrationService from '../../../../../app/services/registrar/phoneNumber/register'

describe('sms module', () => {
  const sock = new EventEmitter()
  const phoneNumber = genPhoneNumber()
  const senderPhoneNumber = genPhoneNumber()

  let verifyStub
  beforeEach(() => (verifyStub = sinon.stub(registrationService, 'verify')))
  afterEach(() => verifyStub.restore())

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
          await handleSms({ sock, phoneNumber, senderPhoneNumber, message })
          expect(verifyStub.callCount).to.be.above(callCount)
          expect(verifyStub.getCall(0).args[0]).to.eql({ sock, phoneNumber, verificationCode })
        })
      })

      describe('when verification succeeds', () => {
        const successStatus = { status: statuses.SUCCESS, message: 'OK' }
        beforeEach(() => verifyStub.returns(Promise.resolve(successStatus)))

        it('returns a success status', async () => {
          expect(await handleSms({ sock, phoneNumber, senderPhoneNumber, message })).to.eql(
            successStatus,
          )
        })
      })

      describe('when verification fails', () => {
        const errorStatus = { status: statuses.SUCCESS, message: 'OK' }
        beforeEach(() => verifyStub.returns(Promise.resolve(errorStatus)))

        it('returns an error status', async () => {
          expect(await handleSms({ sock, phoneNumber, senderPhoneNumber, message })).to.eql(
            errorStatus,
          )
        })
      })
    })
  })

  describe('when sms is a random message from a user', () => {
    const message = 'HELLO! How does this work???'
    const errorMessage =
      'This number only accepts messages sent with the Signal Private Messenger. ' +
      'Please install Signal from https://signal.org and try again.'

    let callCount, result
    beforeEach(async () => {
      callCount = verifyStub.callCount
      result = await handleSms({ sock, phoneNumber, senderPhoneNumber, message })
    })

    it('does not attempt to verify code', () => {
      expect(verifyStub.callCount).to.eql(callCount)
    })

    it('returns a TWIML message with a prompt to install signal', () => {
      expect(result).to.eql({
        status: statuses.SUCCESS,
        body: `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${errorMessage}</Message></Response>`,
      })
    })
  })
})
