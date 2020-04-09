import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import twilio from 'twilio'
import request from 'supertest'
import phoneNumberService from '../../../../../app/services/registrar/phoneNumber'
import { startServer } from '../../../../../app/services/registrar/api'
import { registrar } from '../../../../../app/config/index'
import { EventEmitter } from 'events'
import signal from '../../../../../app/services/signal'

describe('authentication middleware', () => {
  let server

  before(async () => {
    const sock = new EventEmitter()
    sock.write = sinon.stub()
    server = (await startServer(10000, {}, sock)).server
  })

  after(() => server.close())

  describe('for api endpoints', () => {
    it('allows a request that contains auth token in the header', async () => {
      await request(server)
        .get('/hello')
        .set('Token', registrar.authToken)
        .expect(200, { msg: 'hello world' })
    })

    it('allows a request regardless of cregistrartalization in header', async () => {
      await request(server)
        .get('/hello')
        .set('ToKeN', registrar.authToken)
        .expect(200, { msg: 'hello world' })
    })

    it('blocks a request that does not contain an auth token in the header', async () => {
      await request(server)
        .get('/hello')
        .expect(401, { error: 'Not Authorized' })
    })

    it('blocks a request that contains the wrong auth token in the header', async () => {
      await request(server)
        .get('/hello')
        .set('Token', 'foobar')
        .expect(401, { error: 'Not Authorized' })
    })

    it('blocks a request that contains the right auth token in the wrong header', async () => {
      await request(server)
        .get('/hello')
        .set('FooBar', registrar.authToken)
        .expect(401, { error: 'Not Authorized' })
    })
  })

  describe('for twilio callback endpoint', () => {
    let validateSignatureStub, verifyStub

    beforeEach(() => {
      validateSignatureStub = sinon.stub(twilio, 'validateRequest')
      verifyStub = sinon.stub(phoneNumberService, 'verify').returns(Promise.resolve())
    })

    afterEach(() => {
      validateSignatureStub.restore()
      verifyStub.restore()
    })

    it('blocks a request to the twilio endpoint that lacks a valid signature', async () => {
      validateSignatureStub.returns(false)
      await request(server)
        .post('/twilioSms')
        .expect(401, { error: 'Not Authorized' })
    })

    it('accepts a request to the twilio endpoint that contains a valid signature', async () => {
      validateSignatureStub.returns(true)
      await request(server)
        .post('/twilioSms')
        .expect(200)
    })
  })

  describe('for /healthcheck endpoint', () => {
    it('allows a request that does not contain an auth token in the header', async () => {
      sinon.stub(signal, 'isAlive').returns(Promise.resolve({ status: 'SUCCESS' }))
      await request(server)
        .get('/healthcheck')
        .expect(200)
    })
  })
})
