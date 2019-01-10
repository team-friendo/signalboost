import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import request from 'supertest'
import { times, keys, pick } from 'lodash'
import { run } from '../../../app/service/api'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import phoneNumberService, { statuses } from '../../../app/service/phoneNumber'
import { api } from '../../../app/config'

describe('phone number routes', () => {
  const areaCode = '718'
  const phoneNumber = genPhoneNumber()
  const verificationMessage = 'Your Signal verification code: 890-428 for +14322239406'
  const purchasedStatus = { status: statuses.PURCHASED, phoneNumber }
  const verifiedStatus = { status: statuses.PURCHASED, phoneNumber }
  const errorStatus = { status: statuses.ERROR, phoneNumber, error: 'oh noes!' }

  let server
  before(async () => (server = (await run()).server))
  after(() => server.close())

  describe('POST to /phoneNumbers/provision', () => {
    const verifiedStatuses = times(3, () => ({
      status: statuses.VERIFIED,
      phoneNumber: genPhoneNumber(),
    }))

    let provisionNStub
    beforeEach(() => (provisionNStub = sinon.stub(phoneNumberService, 'provisionN')))
    afterEach(() => provisionNStub.restore())

    describe('when num is an int', () => {
      it('attempts to provision `num` phone numbers', async () => {
        await request(server)
          .post('/phoneNumbers/provision')
          .set('Token', api.authToken)
          .send({ num: 3 })

        expect(provisionNStub.getCall(0).args[0].n).to.eql(3)
      })
    })

    describe('when `num` is not an int', () => {
      it('attempts to provision 1 phone number', async () => {
        await request(server)
          .post('/phoneNumbers/provision')
          .set('Token', api.authToken)
          .send({ num: 'foo' })

        expect(provisionNStub.getCall(0).args[0].n).to.eql(1)
      })
    })

    describe('when `num` is not present', () => {
      it('attempts to provision 1 phone number', async () => {
        await request(server)
          .post('/phoneNumbers/provision')
          .set('Token', api.authToken)

        expect(provisionNStub.getCall(0).args[0].n).to.eql(1)
      })
    })

    describe('when provisioning succeeds', () => {
      beforeEach(() => provisionNStub.returns(Promise.resolve(verifiedStatuses)))

      it('returns success statuses', async () => {
        await request(server)
          .post('/phoneNumbers/provision')
          .set('Token', api.authToken)
          .send({ num: 3 })
          .expect(200, verifiedStatuses)
      })
    })
  })

  describe('POST to /phoneNumbers/purchase', () => {
    let purchaseStub
    beforeEach(() => (purchaseStub = sinon.stub(phoneNumberService, 'purchase')))
    afterEach(() => purchaseStub.restore())

    describe('in all cases', () => {
      beforeEach(() => purchaseStub.returns(Promise.resolve({})))
      it('attempts to purchase twilio phone number with area code parsed from request', async () => {
        await request(server)
          .post('/phoneNumbers/purchase')
          .set('Token', api.authToken)
          .send({ areaCode })

        expect(purchaseStub.getCall(0).args[0].areaCode).to.eql(areaCode)
      })
    })

    describe('when the purchase succeeds', () => {
      beforeEach(() => purchaseStub.returns(Promise.resolve(purchasedStatus)))

      it('responds with a a success status', async () => {
        await request(server)
          .post('/phoneNumbers/purchase')
          .set('Token', api.authToken)
          .send({ areaCode })
          .expect(200, purchasedStatus)
      })
    })

    describe('when the purchase fails', () => {
      beforeEach(() => purchaseStub.returns(Promise.resolve(errorStatus)))

      it('responds with an error status', async () => {
        await request(server)
          .post('/phoneNumbers/purchase')
          .set('Token', api.authToken)
          .send({ areaCode })
          .expect(500, errorStatus)
      })
    })
  })

  describe('POST to /phoneNumbers/register', () => {
    let registerStub
    beforeEach(() => (registerStub = sinon.stub(phoneNumberService, 'register')))
    afterEach(() => registerStub.restore())

    describe('in all cases', () => {
      beforeEach(() => registerStub.returns(Promise.resolve({})))

      it('attempts to register a phone number parsed from the request', async () => {
        await request(server)
          .post('/phoneNumbers/register')
          .set('Token', api.authToken)
          .send({ phoneNumber })

        const arg = registerStub.getCall(0).args[0]
        expect(Object.keys(arg)).to.have.members(['db', 'emitter', 'phoneNumber'])
        expect(arg.phoneNumber).to.eql(phoneNumber)
      })
    })
    describe('when registration succeeds', () => {
      beforeEach(() => registerStub.returns(Promise.resolve(verifiedStatus)))

      it('responds with a success status', async () => {
        await request(server)
          .post('/phoneNumbers/register')
          .set('Token', api.authToken)
          .send({ phoneNumber })
          .expect(200, verifiedStatus)
      })
    })

    describe('when registration fails', () => {
      beforeEach(() => registerStub.returns(Promise.resolve(errorStatus)))

      it('responds with an error status', async () => {
        await request(server)
          .post('/phoneNumbers/register')
          .set('Token', api.authToken)
          .send({ phoneNumber })
          .expect(500, errorStatus)
      })
    })
  })

  describe('POST to /twilioSms', () => {
    let verifyStub
    beforeEach(() => (verifyStub = sinon.stub(phoneNumberService, 'verify')))
    afterEach(() => verifyStub.restore())

    describe('in all cases', () => {
      beforeEach(() => verifyStub.returns(Promise.resolve({})))

      it('attempts to verify a phone number with a verification code parsed from the request', async () => {
        await request(server)
          .post('/twilioSms')
          .set('Token', api.authToken)
          .send({ To: phoneNumber, Body: verificationMessage })
        const arg = verifyStub.getCall(0).args[0]

        expect(keys(arg)).to.have.members(['db', 'emitter', 'phoneNumber', 'verificationMessage'])
        expect(pick(arg, ['phoneNumber', 'verificationMessage'])).to.eql({
          phoneNumber,
          verificationMessage,
        })
      })
    })

    describe('when registration succeeds', () => {
      beforeEach(() => verifyStub.returns(Promise.resolve()))

      it('responds with a success code', async () => {
        await request(server)
          .post('/twilioSms')
          .set('Token', api.authToken)
          .send({ phoneNumber })
          .expect(200)
      })
    })

    describe('when registration fails', () => {
      beforeEach(() => verifyStub.callsFake(() => Promise.reject()))

      it('responds with an error code', async () => {
        await request(server)
          .post('/twilioSms')
          .set('Token', api.authToken)
          .send({ phoneNumber })
          .expect(500)
      })
    })
  })
})
