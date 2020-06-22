import { expect } from 'chai'
import { describe, it, before, after, afterEach } from 'mocha'
import { run } from '../../../../app/db/index'
import { smsSenderFactory } from '../../../support/factories/smsSender'

describe('smsSender model', () => {
  let db

  before(async () => (db = await run()))
  afterEach(() => db.smsSender.destroy({ where: {}, force: true }))
  after(() => db.stop())

  it('has correct fields', async () => {
    const smsSender = await db.smsSender.create(smsSenderFactory())

    expect(smsSender.phoneNumber).to.be.a('string')
    expect(smsSender.messagesSent).to.be.a('number')
    expect(smsSender.createdAt).to.be.a('Date')
    expect(smsSender.updatedAt).to.be.a('Date')
  })

  it('sets correct defaults', async () => {
    const smsSender = await db.smsSender.create(
      smsSenderFactory({
        messagesSent: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      }),
    )
    expect(smsSender.messagesSent).to.eql(0)
    expect(smsSender.createdAt).to.be.a('Date')
    expect(smsSender.updatedAt).to.be.a('Date')
  })

  describe('validations', () => {
    it('does not allow a null phone number', async () => {
      const err = await db.smsSender
        .create(smsSenderFactory({ phoneNumber: undefined }))
        .catch(e => e)
      expect(err.message).to.include('phoneNumber cannot be null')
    })
  })
})
