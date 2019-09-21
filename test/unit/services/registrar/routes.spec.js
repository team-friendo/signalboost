import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import request from 'supertest'
import { times, keys, pick } from 'lodash'
import { startServer } from '../../../../app/services/registrar/api'
import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'
import channelService from '../../../../app/services/registrar/channel'
import phoneNumberService, { statuses } from '../../../../app/services/registrar/phoneNumber'
import safetyNumberService from '../../../../app/services/registrar/safetyNumbers'
import signalService from '../../../../app/services/signal'
import { registrar } from '../../../../app/config/index'
import { deepChannelFactory } from '../../../support/factories/channel'

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
  const publishers = [genPhoneNumber(), genPhoneNumber()]
  const channelCreatedStatus = {
    name: 'foo channel',
    status: statuses.ACTIVE,
    phoneNumber,
    publishers,
  }

  let server
  before(async () => (server = (await startServer()).server))
  after(() => server.close())

  describe('GET to /channels', () => {
    let listStub
    beforeEach(() => (listStub = sinon.stub(channelService, 'list')))
    afterEach(() => listStub.restore())

    describe('when channel service returns list of channels', () => {
      const channels = {
        status: 'SUCCESS',
        data: {
          count: 3,
          channels: times(3, deepChannelFactory),
        },
      }
      beforeEach(() => listStub.returns(Promise.resolve(channels)))

      it('returns a list of channels', async () => {
        await request(server)
          .get('/channels')
          .set('Token', registrar.authToken)
          .expect(200, channels.data)
      })
    })

    describe('when phone number service returns an error status', () => {
      const errorStatus = { status: 'ERROR', data: { error: 'oh noes!' } }
      beforeEach(() => listStub.returns(Promise.resolve(errorStatus)))

      it('returns an error status message', async () => {
        await request(server)
          .get('/channels')
          .set('Token', registrar.authToken)
          .expect(500, errorStatus.data)
      })
    })
  })

  describe('POST to /channels', () => {
    let createStub
    beforeEach(() => (createStub = sinon.stub(channelService, 'create')))
    afterEach(() => createStub.restore())

    describe('in all cases', () => {
      beforeEach(() => createStub.returns(Promise.resolve()))

      it('attempts to create channel with values from POST request', async () => {
        await request(server)
          .post('/channels')
          .set('Token', registrar.authToken)
          .send(pick(channelCreatedStatus, ['phoneNumber', 'name', 'publishers']))

        expect(pick(createStub.getCall(0).args[0], ['phoneNumber', 'name', 'publishers'])).to.eql({
          phoneNumber,
          name: 'foo channel',
          publishers,
        })
      })
    })

    describe('when activation succeeds', () => {
      beforeEach(() => createStub.returns(Promise.resolve(channelCreatedStatus)))

      it('creates channel and returns success status', async () => {
        await request(server)
          .post('/channels')
          .set('Token', registrar.authToken)
          .send(pick(channelCreatedStatus, ['phoneNumber', 'name', 'publishers']))
          .expect(200, channelCreatedStatus)
      })
    })

    describe('when activation fails', () => {
      beforeEach(() => createStub.returns(Promise.resolve(errorStatus)))

      it('creates returns error status', async () => {
        await request(server)
          .post('/channels')
          .set('Token', registrar.authToken)
          .send(pick(channelCreatedStatus, ['phoneNumber', 'name', 'publishers']))
          .expect(500, errorStatus)
      })
    })
  })

  describe('POST to /phoneNumbers/trust', () => {
    const memberPhoneNumber = genPhoneNumber()
    let trustStub
    beforeEach(() => (trustStub = sinon.stub(safetyNumberService, 'trustAllForMember')))
    afterEach(() => trustStub.restore())

    describe('in all cases', () => {
      beforeEach(() => trustStub.returns(Promise.resolve()))

      it('attempts to trust all safety numbers associated with a user phone number', async () => {
        await request(server)
          .post('/phoneNumbers/trust')
          .set('Token', registrar.authToken)
          .send({ memberPhoneNumber })

        // slice off db, sock b/c we don't really care about them
        expect(trustStub.getCall(0).args[2]).to.eql(memberPhoneNumber)
      })
    })

    describe('when trusting fails', () => {
      const errStatus = { status: 'ERROR', error: 'identity request timed out' }
      beforeEach(() => trustStub.returns(Promise.resolve(errStatus)))

      it('returns an error status', async () => {
        await request(server)
          .post('/phoneNumbers/trust')
          .set('Token', registrar.authToken)
          .send({ memberPhoneNumber })
          .expect(500, errStatus)
      })
    })

    describe('when trusting succeeds', () => {
      const successStatus = {
        status: 'SUCCESS',
        message: signalService.successMessages.trustSuccess(memberPhoneNumber),
      }
      beforeEach(() => trustStub.returns(Promise.resolve(successStatus)))

      it('returns a success status', async () => {
        await request(server)
          .post('/phoneNumbers/trust')
          .set('Token', registrar.authToken)
          .send({ memberPhoneNumber })
          .expect(200, successStatus)
      })
    })
  })

  describe('GET to /phoneNumbers', () => {
    let listStub
    beforeEach(() => (listStub = sinon.stub(phoneNumberService, 'list')))
    afterEach(() => listStub.restore())

    describe('when phone number service returns list of phone numbers', () => {
      const list = {
        status: 'SUCCESS',
        data: { count: 3, phoneNumbers: times(3, phoneNumberFactory) },
      }
      beforeEach(() => listStub.returns(Promise.resolve(list)))

      it('returns a list of phone numbers', async () => {
        await request(server)
          .get('/phoneNumbers')
          .set('Token', registrar.authToken)
          .expect(200, list.data)
      })
    })

    describe('when phone number service returns an error status', () => {
      const errorStatus = { status: 'ERROR', data: { error: 'oh noes!' } }
      beforeEach(() => listStub.returns(Promise.resolve(errorStatus)))

      it('returns a list of phone numbers', async () => {
        await request(server)
          .get('/phoneNumbers')
          .set('Token', registrar.authToken)
          .expect(500, errorStatus.data)
      })
    })

    describe('filter params', () => {
      beforeEach(() =>
        listStub.returns(Promise.resolve({ count: 0, status: 'SUCCESS', phoneNumbers: [] })),
      )
      describe('when passed a valid filter', () => {
        it('passes filter to phone number service', async () => {
          await request(server)
            .get('/phoneNumbers?filter=ACTIVE')
            .set('Token', registrar.authToken)
          expect(listStub.getCall(0).args[1]).to.eql('ACTIVE')
        })
      })
      describe('when passed an invalid filter', () => {
        it('does not pass filter to phone number service', async () => {
          await request(server)
            .get('/phoneNumbers?filter=DROP%20TABLE;')
            .set('Token', registrar.authToken)
          expect(listStub.getCall(0).args[1]).to.eql(null)
        })
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
          .set('Token', registrar.authToken)
          .send({ num: 3 })

        expect(provisionNStub.getCall(0).args[0].n).to.eql(3)
      })
    })

    describe('when `num` is not an int', () => {
      it('attempts to provision 1 phone number', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', registrar.authToken)
          .send({ num: 'foo' })

        expect(provisionNStub.getCall(0).args[0].n).to.eql(1)
      })
    })

    describe('when `num` is not present', () => {
      it('attempts to provision 1 phone number', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', registrar.authToken)

        expect(provisionNStub.getCall(0).args[0].n).to.eql(1)
      })
    })

    describe('when provisioning succeeds', () => {
      beforeEach(() => provisionNStub.returns(Promise.resolve(verifiedStatuses)))

      it('returns success statuses', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', registrar.authToken)
          .send({ num: 3 })
          .expect(200, verifiedStatuses)
      })
    })

    describe('when provisioning fails', () => {
      beforeEach(() => provisionNStub.returns(Promise.resolve(errorStatuses)))

      it('returns success statuses', async () => {
        await request(server)
          .post('/phoneNumbers')
          .set('Token', registrar.authToken)
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
          .set('Token', registrar.authToken)
          .send({ To: phoneNumber, Body: verificationMessage })
        const arg = verifyStub.getCall(0).args[0]

        expect(keys(arg)).to.have.members(['db', 'sock', 'phoneNumber', 'verificationMessage'])
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
          .set('Token', registrar.authToken)
          .send({ phoneNumber })
          .expect(200)
      })
    })

    describe('when registration fails', () => {
      beforeEach(() => verifyStub.callsFake(() => Promise.reject()))

      it('responds with an error code', async () => {
        await request(server)
          .post('/twilioSms')
          .set('Token', registrar.authToken)
          .send({ phoneNumber })
          .expect(500)
      })
    })
  })
})
