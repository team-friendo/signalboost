import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import request from 'supertest'
import { api } from '../../app/config/index'
import { initDb } from '../../app/db'

describe.skip('provisioning 2 phone numbers', () => {
  /**
   * NOTE(aguestuser|Thu 10 Jan 2019):
   * - this test costs $$ ($1 for phone number, fractional cents for the auth message
   * - :. we keep it skipped but under version control for troubleshooting purposes
   * - please only run it locally if you think something is broken
   * - do NOT leave it unskipped under version control or in CI
   * - thx! <@3
   **/
  let db, count, results

  before(async function(){
    this.timeout(20000)
    db = initDb()
    count = await db.phoneNumber.count({ where: { status: 'VERIFIED' } })
    results = await request('http://localhost:3000')
      .post('/phoneNumbers/provision')
      .set('token', api.authToken)
      .send({ areaCode: 929, num: 2 })
  })

  after(async () => {
    const numbersToDelete = results.body.map(status => status.phoneNumber)
    await db.phoneNumber.destroy({ where: { phoneNumber: { in: numbersToDelete } } })
    await db.sequelize.close()
  })

  it('adds two verified numbers to the database', async () => {
    expect(await db.phoneNumber.count({ where: { status: 'VERIFIED' } })).to.eql(count + 2)
  })

  describe('http response', () => {
    it('is an array of two results', () => {
      expect(results.body).to.have.length(2)
    })
    it('contains VERIFIED statuses', () => {
      results.body.forEach(r => expect(r.status).to.eql('VERIFIED'))
    })
    it('contains phone numbers with requested area code', () => {
      results.body.forEach(r => expect(r.phoneNumber).to.match(/^\+1929\d{7}$/))
    })
  })
})
