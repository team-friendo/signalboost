import { expect } from 'chai'
import { describe, it, before, after, afterEach } from 'mocha'
import { run } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('recycleRequest model', () => {
  let db
  let phoneNumber = genPhoneNumber()

  before(async () => (db = await run()))
  afterEach(async () => await db.recycleRequest.destroy({ where: {} }))
  after(async () => await db.stop())

  it('has the correct fields', async () => {
    const recycleRequest = await db.recycleRequest.create({ phoneNumber })
    expect(recycleRequest.phoneNumber).to.be.a('string')
    expect(recycleRequest.createdAt).to.be.a('Date')
    expect(recycleRequest.updatedAt).to.be.a('Date')
  })

  describe('validations', () => {
    it('requires a phoneNumber', async () => {
      const err = await db.recycleRequest.create({ phoneNumber: undefined }).catch(e => e)
      expect(err.message).to.include('phoneNumber cannot be null')
    })

    it('requires phone number to have valid e164 format', async () => {
      const err = await db.recycleRequest.create({ phoneNumber: 'foobar' }).catch(e => e)
      expect(err.message).to.include('Validation error')
    })

    it("doesn't allow the same phone number to be enqueued twice", async () => {
      await db.recycleRequest.create({ phoneNumber })
      const err = await db.recycleRequest.create({ phoneNumber }).catch(e => e)
      expect(err.name).to.equal('SequelizeUniqueConstraintError')
    })
  })
})
