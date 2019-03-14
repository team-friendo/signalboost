import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import request from 'supertest'
import { times, keys, pick } from 'lodash'
import { startApiServer } from '../../../../app/services/orchestrator/run'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import channelService from '../../../../app/services/orchestrator/channel'
import phoneNumberService, { statuses } from '../../../../app/services/orchestrator/phoneNumber'
import { orchestrator } from '../../../../app/config/index'

describe('routes', () => {
  const phoneNumber = genPhoneNumber()
  const verificationMessage = 'Your Signal verification code: 890-428 for +14322239406'
  const verifiedStatuses = times(3, () => ({
    status: statuses.VERIFIED,
    phoneNumber: genPhoneNumber(),
  }))
  const errorStatus = {
    status: statuses.ERROR,
    phoneNumber,
    error: 'oh noes!',
  }
  const errorStatuses = times(3, () => ({
    status: statuses.ERROR,
    phoneNumber: genPhoneNumber(),
    error: 'oh noes!',
  }))
  const admins = [genPhoneNumber(), genPhoneNumber()]
  const channelActivatedStatus = {
    name: 'foo channel',
    status: statuses.ACTIVE,
    phoneNumber,
    admins,
  }

  let server
  before(async () => (server = (await startApiServer()).server))
  after(() => server.close())

  describe('POST to /channels', () => {
    let activateStub
    beforeEach(() => (activateStub = sinon.stub(channelService, 'activate')))
    afterEach(() => activateStub.restore())

    describe('in all cases', () => {
      beforeEach(() => activateStub.returns(Promise.resolve()))

      it('attempts to activate channel with values from POST request', async () => {
        await request(server)
          .post('/channels')
          .set('Token', orchestrator.authToken)
          .send(pick(channelActivatedStatus, ['phoneNumber', 'name', 'admins']))

        expect(pick(activateStub.getCall(0).args[0], ['phoneNumber', 'name', 'admins'])).to.eql({
          phoneNumber,
          name: 'foo channel',
          admins,
        })
      })
    })

    describe('when activation succeeds', () => {
      beforeEach(() => activateStub.returns(Promise.resolve(channelActivatedStatus)))

      it('activates channel and returns success status', async () => {
        await request(server)
          .post('/channels')
          .set('Token', orchestrator.authToken)
          .send(pick(channelActivatedStatus, ['phoneNumber', 'name', 'admins']))
          .expect(200, channelActivatedStatus)
      })
    })

    describe('when activation fails', () => {
      beforeEach(() => activateStub.returns(Promise.resolve(errorStatus)))

      it('activates returns error status', async () => {
        await request(server)
          .post('/channels')
          .set('Token', orchestrator.authToken)
          .send(pick(channelActivatedStatus, ['phoneNumber', 'name', 'admins']))
          .expect(500, errorStatus)
      })
    })
  })

  describe('POST to /phoneNumbers', () => {
    let provisionNStub
    beforeEach(() => (provisionNStub = sinon.stub(phoneNumberService, 'provisionN')))
    afterEach(() => provisionNStub.restore())

    describe('when num is an int', () => {
      it('attempts to provision `num` phone numbers', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', orchestrator.authToken)
          .send({ num: 3 })

        expect(provisionNStub.getCall(0).args[0].n).to.eql(3)
      })
    })

    describe('when `num` is not an int', () => {
      it('attempts to provision 1 phone number', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', orchestrator.authToken)
          .send({ num: 'foo' })

        expect(provisionNStub.getCall(0).args[0].n).to.eql(1)
      })
    })

    describe('when `num` is not present', () => {
      it('attempts to provision 1 phone number', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', orchestrator.authToken)

        expect(provisionNStub.getCall(0).args[0].n).to.eql(1)
      })
    })

    describe('when provisioning succeeds', () => {
      beforeEach(() => provisionNStub.returns(Promise.resolve(verifiedStatuses)))

      it('returns success statuses', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', orchestrator.authToken)
          .send({ num: 3 })
          .expect(200, verifiedStatuses)
      })
    })

    describe('when provisioning fails', () => {
      beforeEach(() => provisionNStub.returns(Promise.resolve(errorStatuses)))

      it('returns success statuses', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', orchestrator.authToken)
          .send({ num: 3 })
          .expect(500, errorStatuses)
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
          .set('Token', orchestrator.authToken)
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
          .set('Token', orchestrator.authToken)
          .send({ phoneNumber })
          .expect(200)
      })
    })

    describe('when registration fails', () => {
      beforeEach(() => verifyStub.callsFake(() => Promise.reject()))

      it('responds with an error code', async () => {
        await request(server)
          .post('/twilioSms')
          .set('Token', orchestrator.authToken)
          .send({ phoneNumber })
          .expect(500)
      })
    })
  })
})
