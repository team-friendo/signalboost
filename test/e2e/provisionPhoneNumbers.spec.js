import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import request from 'supertest'
import { api } from '../../app/config/index'

describe('provisioning 2 phone numbers', () => {
  /**
   * NOTE(aguestuser|Thu 10 Jan 2019):
   * - this test costs $$ ($1 for phone number, fractional cents for the auth message
   * - :. we keep it skipped but under version control for troubleshooting purposes
   * - please only run it locally if you think something is broken
   * - do NOT leave it unskipped under version control or in CI
   * - thx! <@3
   **/
  let result

  before(async () => {
    result = await request('http://localhost:3000')
      .get('/hello')
      .set('token', api.authToken)
  })

  it('works', () => {
    expect(result.body).to.eql({ msg: 'hello world' })
  })

  it('adds two verified numbers to the database')
  it('returns an array of success statuses with phone numbers')
})
