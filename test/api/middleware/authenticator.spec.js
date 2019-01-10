import { describe, it, before, after } from 'mocha'
import request from 'supertest'
import { run } from '../../../app/service/api'
import { api } from '../../../app/config'

describe('authentication middleware', () => {
  let server
  before(async () => (server = (await run()).server))
  after(() => server.close())

  it('allows a request that contains auth token in the header', async () => {
    await request(server)
      .get('/hello')
      .set('Token', api.authToken)
      .expect(200, { msg: 'hello world' })
  })

  it('allows a request regardless of capitalization in header', async () => {
    await request(server)
      .get('/hello')
      .set('ToKeN', api.authToken)
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
      .set('FooBar', api.authToken)
      .expect(401, { error: 'Not Authorized' })
  })
})