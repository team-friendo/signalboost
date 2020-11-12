import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import { run } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory } from '../../../support/factories/channel'

describe('destructionRequest model', () => {
  let db, channel
  let channelPhoneNumber = genPhoneNumber()

  before(async () => (db = await run()))
  beforeEach(async () => {
    channel = await db.channel.create(channelFactory({ phoneNumber: channelPhoneNumber }))
  })
  afterEach(async () => {
    await db.destructionRequest.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
  })
  after(async () => await db.stop())

  it('has the correct fields', async () => {
    const destructionRequest = await db.destructionRequest.create({ channelPhoneNumber })
    expect(destructionRequest.channelPhoneNumber).to.be.a('string')
    expect(destructionRequest.lastNotified).to.be.a('Date')
    expect(destructionRequest.createdAt).to.be.a('Date')
    expect(destructionRequest.updatedAt).to.be.a('Date')
  })

  describe('defaults', () => {
    it('sets lastNotified to now() by default', async () => {
      const dr = await db.destructionRequest.create({ channelPhoneNumber, lastNotified: undefined })
      expect(dr.lastNotified).to.be.a('Date')
    })
  })

  describe('validations', () => {
    it('requires a channelPhoneNumber', async () => {
      const err = await db.destructionRequest
        .create({ channelPhoneNumber: undefined })
        .catch(e => e)
      expect(err.message).to.include('channelPhoneNumber cannot be null')
    })

    it('requires phone number to have valid e164 format', async () => {
      const err = await db.destructionRequest.create({ channelPhoneNumber: 'foobar' }).catch(e => e)
      expect(err.message).to.include('Validation error')
    })

    it("doesn't allow the same phone number to be enqueued twice", async () => {
      await db.destructionRequest.create({ channelPhoneNumber })
      const err = await db.destructionRequest.create({ channelPhoneNumber }).catch(e => e)
      expect(err.name).to.equal('SequelizeUniqueConstraintError')
    })

    it("doesn't allow a destruction request for a channel that does not exist", async () => {
      const err = await db.destructionRequest
        .create({ channelPhoneNumber: genPhoneNumber() })
        .catch(e => e)
      expect(err.name).to.equal('SequelizeForeignKeyConstraintError')
    })
  })

  describe('associations', () => {
    it('belongs to a channel', async () => {
      const destructionRequest = await db.destructionRequest.create({
        channelPhoneNumber: channel.phoneNumber,
      })
      expect((await destructionRequest.getChannel()).dataValues).to.eql(channel.dataValues)
    })
  })
})
