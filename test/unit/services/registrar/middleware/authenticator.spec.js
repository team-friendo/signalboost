import { describe, it, before, after } from 'mocha'
import request from 'supertest'
import { startServer } from '../../../../../app/services/registrar/api'
import { registrar } from '../../../../../app/config/index'

describe('authentication middleware', () => {
  let server
  before(async () => (server = (await startServer()).server))
  after(() => server.close())

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
