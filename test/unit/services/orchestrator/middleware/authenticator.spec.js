import { describe, it, before, after } from 'mocha'
import request from 'supertest'
import { startApiServer } from '../../../../../app/services/orchestrator/run'
import { orchestrator } from '../../../../../app/config/index'

describe('authentication middleware', () => {
  let server
  before(async () => (server = (await startApiServer()).server))
  after(() => server.close())

  it('allows a request that contains auth token in the header', async () => {
    await request(server)
      .get('/hello')
      .set('Token', orchestrator.authToken)
      .expect(200, { msg: 'hello world' })
  })

  it('allows a request regardless of corchestratortalization in header', async () => {
    await request(server)
      .get('/hello')
      .set('ToKeN', orchestrator.authToken)
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
      .set('FooBar', orchestrator.authToken)
      .expect(401, { error: 'Not Authorized' })
  })
})