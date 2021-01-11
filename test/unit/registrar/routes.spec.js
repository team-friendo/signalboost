import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import request from 'supertest'
import twilio from 'twilio'
import { times, pick } from 'lodash'
import { run } from '../../../app/api'
import { genPhoneNumber, phoneNumberFactory } from '../../support/factories/phoneNumber'
import channelRegistrar from '../../../app/registrar/channel'
import phoneNumberService, { statuses } from '../../../app/registrar/phoneNumber'
import { deepChannelFactory } from '../../support/factories/channel'
const {
  api: { authToken },
} = require('../../../app/config')

describe('routes', () => {
  const phoneNumber = genPhoneNumber()
  const verificationMessage = 'Your Signal verification code: 890-428 for +14322239406'
  const verifiedStatus = {
    status: statuses.VERIFIED,
    phoneNumber,
  }
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
  const channelCreatedStatus = {
    status: statuses.ACTIVE,
    phoneNumber,
    admins,
  }
  const captchaToken =
    '03AOLTBLR84zMWX9mh1gHaFZJwLYflPh0Bsi3_oYwsxJ9bTt_dV9mcmOMmhHZ19E_4waszAMc7EmPM7IfGSJc4471E45JLXgr2YjRlp36k7_AU5t8ww1IOrZid8hl9fqMs9FNIWx9IUj'

  let api
  before(async () => (api = await run(200)))
  after(() => {
    sinon.restore()
    api.stop()
  })

  describe('GET to /channels', () => {
    let listStub
    beforeEach(() => (listStub = sinon.stub(channelRegistrar, 'list')))
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
        await request(api.server)
          .get('/channels')
          .set('Token', authToken)
          .expect(200, channels.data)
      })
    })

    describe('when phone number service returns an error status', () => {
      const errorStatus = { status: 'ERROR', data: { error: 'oh noes!' } }
      beforeEach(() => listStub.returns(Promise.resolve(errorStatus)))

      it('returns an error status message', async () => {
        await request(api.server)
          .get('/channels')
          .set('Token', authToken)
          .expect(500, errorStatus.data)
      })
    })
  })

  describe('POST to /channels', () => {
    let createStub
    beforeEach(() => (createStub = sinon.stub(channelRegistrar, 'create')))
    afterEach(() => createStub.restore())

    describe('in all cases', () => {
      beforeEach(() => createStub.returns(Promise.resolve()))

      it('attempts to create channel with values from POST request', async () => {
        await request(api.server)
          .post('/channels')
          .set('Token', authToken)
          .send(pick(channelCreatedStatus, ['phoneNumber', 'name', 'admins']))

        expect(pick(createStub.getCall(0).args[0], ['phoneNumber', 'admins'])).to.eql({
          phoneNumber,
          admins,
        })
      })
    })

    describe('when activation succeeds', () => {
      beforeEach(() => createStub.returns(Promise.resolve(channelCreatedStatus)))

      it('creates channel and returns success status', async () => {
        await request(api.server)
          .post('/channels')
          .set('Token', authToken)
          .send(pick(channelCreatedStatus, ['phoneNumber', 'name', 'admins']))
          .expect(200, channelCreatedStatus)
      })
    })

    describe('when activation fails', () => {
      beforeEach(() => createStub.returns(Promise.resolve(errorStatus)))

      it('creates returns error status', async () => {
        await request(api.server)
          .post('/channels')
          .set('Token', authToken)
          .send(pick(channelCreatedStatus, ['phoneNumber', 'name', 'admins']))
          .expect(500, errorStatus)
      })
    })
  })

  describe('POST to /channels/admins', () => {
    let addAdminStub
    beforeEach(() => (addAdminStub = sinon.stub(channelRegistrar, 'addAdmin')))
    afterEach(() => addAdminStub.restore())

    describe('in all cases', () => {
      beforeEach(() => addAdminStub.returns(Promise.resolve()))

      it('attempts to addAdmin channel with values from POST request', async () => {
        await request(api.server)
          .post('/channels/admins')
          .set('Token', authToken)
          .send({ channelPhoneNumber: phoneNumber, adminPhoneNumber: admins[0] })

        expect(addAdminStub.getCall(0).args).to.eql([
          {
            channelPhoneNumber: phoneNumber,
            adminPhoneNumber: admins[0],
          },
        ])
      })
    })

    describe('when adding admin succeeds', () => {
      const successStatus = {
        status: 'SUCCESS',
        message: 'fake add success',
      }
      beforeEach(() => addAdminStub.returns(Promise.resolve(successStatus)))

      it('creates channel and returns success status', async () => {
        await request(api.server)
          .post('/channels/admins')
          .set('Token', authToken)
          .send({ channelPhoneNumber: phoneNumber, adminPhoneNumber: admins[0] })
          .expect(200, successStatus)
      })
    })

    describe('when adding admin fails', () => {
      beforeEach(() => addAdminStub.returns(Promise.resolve(errorStatus)))

      it('creates returns error status', async () => {
        await request(api.server)
          .post('/channels/admins')
          .set('Token', authToken)
          .send({ channelPhoneNumber: phoneNumber, adminPhoneNumber: admins[0] })
          .expect(500, errorStatus)
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
        await request(api.server)
          .get('/phoneNumbers')
          .set('Token', authToken)
          .expect(200, list.data)
      })
    })

    describe('when phone number service returns an error status', () => {
      const errorStatus = { status: 'ERROR', data: { error: 'oh noes!' } }
      beforeEach(() => listStub.returns(Promise.resolve(errorStatus)))

      it('returns a list of phone numbers', async () => {
        await request(api.server)
          .get('/phoneNumbers')
          .set('Token', authToken)
          .expect(500, errorStatus.data)
      })
    })

    describe('filter params', () => {
      beforeEach(() =>
        listStub.returns(Promise.resolve({ count: 0, status: 'SUCCESS', phoneNumbers: [] })),
      )
      describe('when passed a valid filter', () => {
        it('passes filter to phone number service', async () => {
          await request(api.server)
            .get('/phoneNumbers?filter=ACTIVE')
            .set('Token', authToken)
          expect(listStub.getCall(0).args).to.eql(['ACTIVE'])
        })
      })
      describe('when passed an invalid filter', () => {
        it('does not pass filter to phone number service', async () => {
          await request(api.server)
            .get('/phoneNumbers?filter=DROP%20TABLE;')
            .set('Token', authToken)
          expect(listStub.getCall(0).args).to.eql([null])
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
        await request(api.server)
          .post('/phoneNumbers')
          .set('Token', authToken)
          .send({ num: 3 })

        expect(provisionNStub.getCall(0).args[0].n).to.eql(3)
      })
    })

    describe('when `num` is not an int', () => {
      it('attempts to provision 1 phone number', async () => {
        await request(api.server)
          .post('/phoneNumbers')
          .set('Token', authToken)
          .send({ num: 'foo' })

        expect(provisionNStub.getCall(0).args[0].n).to.eql(1)
      })
    })

    describe('when `num` is not present', () => {
      it('attempts to provision 1 phone number', async () => {
        await request(api.server)
          .post('/phoneNumbers')
          .set('Token', authToken)

        expect(provisionNStub.getCall(0).args[0].n).to.eql(1)
      })
    })

    describe('when provisioning succeeds', () => {
      beforeEach(() => provisionNStub.returns(Promise.resolve(verifiedStatuses)))

      it('returns success statuses', async () => {
        await request(api.server)
          .post('/phoneNumbers')
          .set('Token', authToken)
          .send({ num: 3 })
          .expect(200, verifiedStatuses)
      })
    })

    describe('when provisioning fails', () => {
      beforeEach(() => provisionNStub.returns(Promise.resolve(errorStatuses)))

      it('returns success statuses', async () => {
        await request(api.server)
          .post('/phoneNumbers')
          .set('Token', authToken)
          .send({ num: 3 })
          .expect(500, errorStatuses)
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
        await request(api.server)
          .post('/phoneNumbers/register')
          .set('Token', authToken)
          .send({ phoneNumber, captchaToken })

        expect(registerStub.getCall(0).args).to.eql([phoneNumber, captchaToken])
      })
    })
    describe('when registration succeeds', () => {
      beforeEach(() => registerStub.returns(Promise.resolve(verifiedStatus)))

      it('responds with a success status', async () => {
        await request(api.server)
          .post('/phoneNumbers/register')
          .set('Token', authToken)
          .send({ phoneNumber })
          .expect(200, verifiedStatus)
      })
    })

    describe('when registration fails', () => {
      beforeEach(() => registerStub.returns(Promise.resolve(errorStatus)))

      it('responds with an error status', async () => {
        await request(api.server)
          .post('/phoneNumbers/register')
          .set('Token', authToken)
          .send({ phoneNumber })
          .expect(500, errorStatus)
      })
    })
  })

  describe('DELETE to /phoneNumbers', () => {
    let requestToDestroy
    beforeEach(() => (requestToDestroy = sinon.stub(phoneNumberService, 'requestToDestroy')))
    afterEach(() => requestToDestroy.restore())

    describe('when destruction request succeeds', () => {
      beforeEach(() =>
        requestToDestroy.returns(
          Promise.resolve([
            {
              status: 'SUCCESS',
              message: 'Issued request to destroy +19382223543',
            },
          ]),
        ),
      )

      it('returns success status', async () => {
        await request(api.server)
          .delete('/phoneNumbers')
          .set('Token', authToken)
          .send({ phoneNumbers: '+19382223543' })
          .expect(200)
      })
    })

    describe('when destruction request fails', () => {
      beforeEach(() =>
        requestToDestroy.returns(
          Promise.resolve([
            {
              status: 'ERROR',
              message: '+16154804259 has already been enqueued for destruction.',
            },
          ]),
        ),
      )

      it('returns error status', async () => {
        await request(api.server)
          .delete('/phoneNumbers')
          .set('Token', authToken)
          .send({ phoneNumbers: '+16154804259' })
          .expect(500)
      })
    })
  })

  describe('POST to /twilioSms', () => {
    const senderPhoneNumber = genPhoneNumber()
    let validateSignatureStub, handleSmsStub

    beforeEach(() => {
      validateSignatureStub = sinon.stub(twilio, 'validateRequest').returns(true)
      handleSmsStub = sinon.stub(phoneNumberService, 'handleSms')
    })

    afterEach(() => {
      validateSignatureStub.restore()
      handleSmsStub.restore()
    })

    describe('in all cases', () => {
      beforeEach(() => handleSmsStub.returns(Promise.resolve({})))

      it('attempts to handle the message (either by verifying a code or providing a response)', async () => {
        await request(api.server)
          .post('/twilioSms')
          .set('Token', authToken)
          .send({ To: phoneNumber, From: senderPhoneNumber, Body: verificationMessage })

        expect(
          pick(handleSmsStub.getCall(0).args[0], ['phoneNumber', 'senderPhoneNumber', 'message']),
        ).to.eql({
          phoneNumber,
          senderPhoneNumber,
          message: verificationMessage,
        })
      })
    })

    describe('when handling message succeeds', () => {
      beforeEach(() =>
        handleSmsStub.returns(
          Promise.resolve({
            status: statuses.SUCCESS,
            body: 'OK',
          }),
        ),
      )

      it('responds with a success code', async () => {
        await request(api.server)
          .post('/twilioSms')
          .set('Token', authToken)
          .send({ phoneNumber })
          .expect(200, 'OK')
      })
    })

    describe('when verification fails', () => {
      beforeEach(() =>
        handleSmsStub.returns(
          Promise.resolve({
            status: statuses.ERROR,
            message: 'oh noes!',
          }),
        ),
      )

      it('responds with an error code', async () => {
        await request(api.server)
          .post('/twilioSms')
          .set('Token', authToken)
          .send({ phoneNumber })
          .expect(500, 'oh noes!')
      })
    })
  })
})
