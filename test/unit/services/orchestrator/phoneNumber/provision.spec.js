import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { provisionN, statuses, errors } from '../../../../../app/services/orchestrator/phoneNumber/index'
import purchase from '../../../../../app/services/orchestrator/phoneNumber/purchase'
import register from '../../../../../app/services/orchestrator/phoneNumber/register'
import { genPhoneNumber } from '../../../../support/factories/phoneNumber'

describe('phone number services -- provision module', () => {
  let purchaseNStub, registerAllStub
  beforeEach(() => {
    purchaseNStub = sinon.stub(purchase, 'purchaseN')
    registerAllStub = sinon.stub(register, 'registerAll')
  })
  afterEach(() => {
    purchaseNStub.restore()
    registerAllStub.restore()
  })

  describe('provisioning 3 phone numbers', () => {
    describe('when all purchases and registrations succeed', () => {
      const verifiedStatuses = times(3, () => ({
        status: statuses.VERIFIED,
        phoneNumber: genPhoneNumber(),
      }))
      let result

      beforeEach(async () => {
        purchaseNStub.returns(Promise.resolve(times(3, () => ({ status: statuses.PURCHASED }))))
        registerAllStub.returns(Promise.resolve(verifiedStatuses))
        result = await provisionN({ n: 3 })
      })

      it('purchases 3 numbers', () => {
        expect(purchaseNStub.getCall(0).args[0].n).to.eql(3)
      })

      it('registers purchased numbers', () => {
        expect(registerAllStub.callCount).to.eql(1)
      })

      it('returns an array of 3 success statuses', async () => {
        expect(result).to.eql(verifiedStatuses)
      })
    })

    describe('when a purchase fails', () => {
      const failedPurchaseStatuses = [
        {
          status: statuses.ERROR,
          phoneNumber: genPhoneNumber(),
          error: errors.registrationFailed('boom!'),
        },
        {
          status: statuses.VERIFIED,
          phoneNumber: genPhoneNumber(),
        },
        {
          status: statuses.VERIFIED,
          phoneNumber: genPhoneNumber(),
        },
      ]
      let result

      beforeEach(async () => {
        purchaseNStub.callsFake(() => Promise.resolve(failedPurchaseStatuses))
        result = await provisionN({})
      })

      it('returns an array of success and error statuses from the purchase step', () => {
        expect(result).to.eql(failedPurchaseStatuses)
      })

      it('does not attempt the registration step', () => {
        expect(registerAllStub.callCount).to.eql(0)
      })
    })
    describe('when all purchases succeed but one registration fails', () => {
      const failedVerificationStatuses = [
        {
          status: statuses.ERROR,
          phoneNumber: genPhoneNumber(),
          error: errors.verificationFailed('boom!'),
        },
        {
          status: statuses.VERIFIED,
          phoneNumber: genPhoneNumber(),
        },
        {
          status: statuses.VERIFIED,
          phoneNumber: genPhoneNumber(),
        },
      ]
      let result

      beforeEach(async () => {
        purchaseNStub.returns(Promise.resolve(times(3, () => ({ status: statuses.PURCHASED }))))
        registerAllStub.returns(Promise.resolve(failedVerificationStatuses))
        result = await provisionN({ n: 3 })
      })

      it('registers the purchased numbers', () => {
        expect(registerAllStub.callCount).to.eql(1)
      })

      it('returns an array of success and error status from the registration step', () => {
        expect(result).to.eql(failedVerificationStatuses)
      })
    })
  })
})
