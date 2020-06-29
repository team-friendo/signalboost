import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { run } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('recycleablePhoneNumber model', () => {
  let db
  let channelPhoneNumber = genPhoneNumber()

  before(async () => {
    db = await run()
  })

  after(async () => {
    await db.recycleablePhoneNumber.destroy({ where: {} })
    await db.stop()
  })

  it('has the correct fields', async () => {
    const enqueuedChannelNumber = await db.recycleablePhoneNumber.create({
      channelPhoneNumber,
      whenEnqueued: new Date().toISOString(),
    })
    expect(enqueuedChannelNumber.channelPhoneNumber).to.be.a('string')
    expect(enqueuedChannelNumber.whenEnqueued).to.be.a('Date')
  })

  describe('validations', () => {
    it('requires a channelPhoneNumber', async () => {
      const err = await db.recycleablePhoneNumber
        .create({ whenEnqueued: new Date().toISOString() })
        .catch(e => e)
      expect(err.message).to.include('channelPhoneNumber cannot be null')
    })

    it('requires a timestamp for whenEnqueued', async () => {
      const err = await db.recycleablePhoneNumber
        .create({ channelPhoneNumber: genPhoneNumber() })
        .catch(e => e)

      expect(err.message).to.include('whenEnqueued cannot be null')
    })

    it("doesn't allow the same phone number to be enqueued twice", async () => {
      const err = await db.recycleablePhoneNumber
        .create({
          channelPhoneNumber,
          whenEnqueued: new Date().toISOString(),
        })
        .catch(e => JSON.stringify(e.errors[0]))
      expect(err).to.include('channelPhoneNumber must be unique')
    })
  })
})
