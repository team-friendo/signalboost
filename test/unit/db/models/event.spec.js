import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { run } from '../../../../app/db/index'
import { eventFactory } from '../../../support/factories/event'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('events model', () => {
  let db

  before(async () => {
    db = await run()
  })
  after(async () => {
    await db.event.destroy({ where: {} })
    await db.stop()
  })

  it('has correct fields', async () => {
    const event = await db.event.create(eventFactory())
    expect(event.id).to.be.a('string')
    expect(event.type).to.be.a('string')
    expect(event.phoneNumberHash).to.be.a('string')
    expect(event.createdAt).to.be.a('Date')
    expect(event.updatedAt).to.be.a('Date')
  })

  describe('validations', () => {
    it('does not allow null type field', async () => {
      const err = await db.event.create(eventFactory({ type: undefined })).catch(e => e)
      expect(err.message).to.contain('cannot be null')
    })

    it('requires type to be a valid enum variant', async () => {
      const err = await db.event.create(eventFactory({ type: 'foobar' })).catch(e => e)
      expect(err.message).to.contain('invalid input value for enum')
    })

    it('does not allow null phoneNumberHash field', async () => {
      const err = await db.event.create(eventFactory({ phoneNumberHash: undefined })).catch(e => e)
      expect(err.message).to.contain('cannot be null')
    })

    it('requires phoneNumberHash to be a valid sha256 hash', async () => {
      const err = await db.event
        .create(eventFactory({ phoneNumberHash: genPhoneNumber() }))
        .catch(e => e)
      expect(err.message).to.contain('sha256 hash')
    })
  })
})
