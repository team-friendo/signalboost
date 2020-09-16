import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import { run } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory } from '../../../support/factories/channel'

describe('recycleRequest model', () => {
  let db, channel
  let channelPhoneNumber = genPhoneNumber()

  before(async () => (db = await run()))
  beforeEach(async () => {
    channel = await db.channel.create(channelFactory({ phoneNumber: channelPhoneNumber }))
  })
  afterEach(async () => {
    await db.recycleRequest.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
  })
  after(async () => await db.stop())

  it('has the correct fields', async () => {
    const recycleRequest = await db.recycleRequest.create({ channelPhoneNumber })
    expect(recycleRequest.channelPhoneNumber).to.be.a('string')
    expect(recycleRequest.createdAt).to.be.a('Date')
    expect(recycleRequest.updatedAt).to.be.a('Date')
  })

  describe('validations', () => {
    it('requires a channelPhoneNumber', async () => {
      const err = await db.recycleRequest.create({ channelPhoneNumber: undefined }).catch(e => e)
      expect(err.message).to.include('channelPhoneNumber cannot be null')
    })

    it('requires phone number to have valid e164 format', async () => {
      const err = await db.recycleRequest.create({ channelPhoneNumber: 'foobar' }).catch(e => e)
      expect(err.message).to.include('Validation error')
    })

    it("doesn't allow the same phone number to be enqueued twice", async () => {
      await db.recycleRequest.create({ channelPhoneNumber })
      const err = await db.recycleRequest.create({ channelPhoneNumber }).catch(e => e)
      expect(err.name).to.equal('SequelizeUniqueConstraintError')
    })

    it("doesn't allow a recycle request for a channel that does not exist", async () => {
      const err = await db.recycleRequest
        .create({ channelPhoneNumber: genPhoneNumber() })
        .catch(e => e)
      expect(err.name).to.equal('SequelizeForeignKeyConstraintError')
    })
  })

  describe('associations', () => {
    it('belongs to a channel', async () => {
      const recycleRequest = await db.recycleRequest.create({
        channelPhoneNumber: channel.phoneNumber,
      })
      expect((await recycleRequest.getChannel()).dataValues).to.eql(channel.dataValues)
    })
  })
})
