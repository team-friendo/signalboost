import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { provisionN, statuses } from '../../../../../app/registrar/phoneNumber/index'
import purchase from '../../../../../app/registrar/phoneNumber/purchase'
import register from '../../../../../app/registrar/phoneNumber/register'
import { genPhoneNumber } from '../../../../support/factories/phoneNumber'
const {
  signal: { registrationBatchSize },
} = require('../../../../../app/config/index')

describe('phone number services -- provision module', () => {
  const phoneNumbers = times(3, genPhoneNumber)
  let purchaseNStub, registerManyStub
  beforeEach(() => {
    purchaseNStub = sinon.stub(purchase, 'purchaseN')
    registerManyStub = sinon.stub(register, 'registerMany')
  })
  afterEach(() => {
    sinon.restore()
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
        registerManyStub.returns(Promise.resolve(verifiedStatuses))
        result = await provisionN({ n: 3 })
      })

      it('purchases 3 numbers', () => {
        expect(purchaseNStub.getCall(0).args[0].n).to.eql(3)
      })

      it('registers purchased numbers', () => {
        expect(registerManyStub.callCount).to.eql(1)
      })

      it('returns an array of 3 success statuses', async () => {
        expect(result).to.eql(verifiedStatuses)
      })
    })

    describe('when a purchase or a registration fails', () => {
      let result
      beforeEach(async () => {
        purchaseNStub.callsFake(() =>
          Promise.resolve([
            {
              status: statuses.ERROR,
              phoneNumber: phoneNumbers[0],
              error: 'purchase failed!',
            },
            {
              status: statuses.PURCHASED,
              phoneNumber: phoneNumbers[1],
            },
            {
              status: statuses.PURCHASED,
              phoneNumber: phoneNumbers[2],
            },
          ]),
        )
        registerManyStub.callsFake(({ phoneNumbers }) =>
          Promise.resolve([
            { phoneNumber: phoneNumbers[0], status: statuses.VERIFIED },
            {
              phoneNumber: phoneNumbers[1],
              status: statuses.ERROR,
              error: 'registration failed!',
            },
          ]),
        )
        result = await provisionN({})
      })

      it('returns an array of success and error statuses', () => {
        expect(result).to.eql([
          { status: 'ERROR', phoneNumber: phoneNumbers[0], error: 'purchase failed!' },
          { status: 'ERROR', phoneNumber: phoneNumbers[2], error: 'registration failed!' },
          { status: 'VERIFIED', phoneNumber: phoneNumbers[1] },
        ])
      })

      it('only attempts to register successfully purchased number', () => {
        expect(registerManyStub.getCall(0).args[0].phoneNumbers.length).to.eql(2)
      })
    })
  })

  describe('trying to provision more phone numbers than registration batch size', () => {
    let result
    beforeEach(async () => {
      result = await provisionN({ n: registrationBatchSize + 1 }).catch(a => a)
    })

    it('returns an error message', () => {
      expect(result).to.eql({
        status: 'ERROR',
        error: `A maximum of ${registrationBatchSize} phone numbers may be provisioned at a time`,
      })
    })

    it('does not attempt to purchase any phone numbers', () => {
      expect(purchaseNStub.callCount).to.eql(0)
    })

    it('does not attempt to register any phone numbers', () => {
      expect(registerManyStub.callCount).to.eql(0)
    })
  })
})
