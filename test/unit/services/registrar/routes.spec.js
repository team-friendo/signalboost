import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import request from 'supertest'
import twilio from 'twilio'
import { times, pick } from 'lodash'
import { startServer } from '../../../../app/services/registrar/api'
import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'
import channelRegistrar from '../../../../app/services/registrar/channel'
import phoneNumberService, { statuses } from '../../../../app/services/registrar/phoneNumber'
import { registrar } from '../../../../app/config/index'
import { deepChannelFactory } from '../../../support/factories/channel'

describe('routes', () => {
  const db = { fake: 'db' }
  const sock = { fake: 'sock' }
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
  const channelCreatedStatus = {
    name: 'foo channel',
    status: statuses.ACTIVE,
    phoneNumber,
    admins,
  }

  let server
  before(async () => (server = (await startServer(200, sock)).server))
  after(() => {
    sinon.restore()
    server.close()
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
    beforeEach(() => (createStub = sinon.stub(channelRegistrar, 'create')))
    afterEach(() => createStub.restore())

    describe('in all cases', () => {
      beforeEach(() => createStub.returns(Promise.resolve()))

      it('attempts to create channel with values from POST request', async () => {
        await request(server)
          .post('/channels')
          .set('Token', registrar.authToken)
          .send(pick(channelCreatedStatus, ['phoneNumber', 'name', 'admins']))

        expect(pick(createStub.getCall(0).args[0], ['phoneNumber', 'name', 'admins'])).to.eql({
          phoneNumber,
          name: 'foo channel',
          admins,
        })
      })
    })

    describe('when activation succeeds', () => {
      beforeEach(() => createStub.returns(Promise.resolve(channelCreatedStatus)))

      it('creates channel and returns success status', async () => {
        await request(server)
          .post('/channels')
          .set('Token', registrar.authToken)
          .send(pick(channelCreatedStatus, ['phoneNumber', 'name', 'admins']))
          .expect(200, channelCreatedStatus)
      })
    })

    describe('when activation fails', () => {
      beforeEach(() => createStub.returns(Promise.resolve(errorStatus)))

      it('creates returns error status', async () => {
        await request(server)
          .post('/channels')
          .set('Token', registrar.authToken)
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
        await request(server)
          .post('/channels/admins')
          .set('Token', registrar.authToken)
          .send({ channelPhoneNumber: phoneNumber, adminPhoneNumber: admins[0] })

        expect(addAdminStub.getCall(0).args).to.eql([
          {
            sock,
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
        await request(server)
          .post('/channels/admins')
          .set('Token', registrar.authToken)
          .send({ channelPhoneNumber: phoneNumber, adminPhoneNumber: admins[0] })
          .expect(200, successStatus)
      })
    })

    describe('when adding admin fails', () => {
      beforeEach(() => addAdminStub.returns(Promise.resolve(errorStatus)))

      it('creates returns error status', async () => {
        await request(server)
          .post('/channels/admins')
          .set('Token', registrar.authToken)
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
          expect(listStub.getCall(0).args).to.eql(['ACTIVE'])
        })
      })
      describe('when passed an invalid filter', () => {
        it('does not pass filter to phone number service', async () => {
          await request(server)
            .get('/phoneNumbers?filter=DROP%20TABLE;')
            .set('Token', registrar.authToken)
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

  describe('DELETE to /phoneNumbers', () => {
    let destroyStub
    beforeEach(() => (destroyStub = sinon.stub(phoneNumberService, 'destroy')))
    afterEach(() => destroyStub.restore())

    describe('destroy service is successful', () => {
      it('returns a success status', async () => {
        destroyStub.returns({ status: 'SUCCESS' })
        await request(server)
          .delete('/phoneNumbers')
          .set('Token', registrar.authToken)
          .send({ phoneNumber: '+12223334444' })
          .expect(200)
      })
    })

    describe('destroy service is unsuccessful', () => {
      it('returns an error status', async () => {
        destroyStub.returns({ status: 'ERROR' })
        await request(server)
          .delete('/phoneNumbers')
          .set('Token', registrar.authToken)
          .send({ phoneNumber: '+12223334444' })
          .expect(500)
      })
    })
  })

  describe('POST to /phoneNumbers/recycle', () => {
    let recycleStub
    beforeEach(() => (recycleStub = sinon.stub(phoneNumberService, 'recycle')))
    afterEach(() => recycleStub.restore())

    describe('when recycling succeeds', () => {
      beforeEach(() =>
        recycleStub.returns(
          Promise.resolve([
            {
              status: 'SUCCESS',
              data: {
                status: 'VERIFIED',
                phoneNumber: '+19382223543',
                twilioSid: 'PNc505ce2a87c34bfbe598c54120865bcf',
              },
            },
          ]),
        ),
      )

      it('returns success status', async () => {
        await request(server)
          .post('/phoneNumbers/recycle')
          .set('Token', registrar.authToken)
          .send({ phoneNumbers: '+19382223543' })
          .expect(200)
      })
    })

    describe('when recycling fails', () => {
      beforeEach(() =>
        recycleStub.returns(
          Promise.resolve([
            {
              status: 'ERROR',
              message: 'Channel not found for +16154804259',
            },
          ]),
        ),
      )

      it('returns error status', async () => {
        await request(server)
          .post('/phoneNumbers/recycle')
          .set('Token', registrar.authToken)
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
        await request(server)
          .post('/twilioSms')
          .set('Token', registrar.authToken)
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
        await request(server)
          .post('/twilioSms')
          .set('Token', registrar.authToken)
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
        await request(server)
          .post('/twilioSms')
          .set('Token', registrar.authToken)
          .send({ phoneNumber })
          .expect(500, 'oh noes!')
      })
    })
  })
})
