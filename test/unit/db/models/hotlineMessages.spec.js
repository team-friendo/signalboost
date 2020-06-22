import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { times } from 'lodash'
import { run } from '../../../../app/db'
import { hotlineMessageFactory } from '../../../support/factories/hotlineMessages'
import { channelFactory } from '../../../support/factories/channel'

describe('hotlineMessages model', () => {
  let db, hotlineMessage, channel

  before(async () => (db = await run()))
  beforeEach(async () => {
    channel = await db.channel.create(channelFactory())
  })

  afterEach(async () => {
    await db.hotlineMessage.destroy({ where: {}, force: true })
    return db.channel.destroy({ where: {}, force: true })
  })
  after(() => db.stop())

  it('has correct fields', async () => {
    hotlineMessage = await db.hotlineMessage.create(
      hotlineMessageFactory({
        channelPhoneNumber: channel.phoneNumber,
      }),
    )

    expect(hotlineMessage.id).to.be.a('number')
    expect(hotlineMessage.channelPhoneNumber).to.be.a('string')
    expect(hotlineMessage.memberPhoneNumber).to.be.a('string')
    expect(hotlineMessage.updatedAt).to.be.a('Date')
    expect(hotlineMessage.createdAt).to.be.a('Date')
  })

  describe('validations', () => {
    it('requires a channelPhoneNumber', async () => {
      const err = await db.hotlineMessage
        .create(
          hotlineMessageFactory({
            channelPhoneNumber: undefined,
          }),
        )
        .catch(e => e)
      expect(err.message).to.contain('channelPhoneNumber cannot be null')
    })

    it('requires a memberPhoneNumber', async () => {
      const err = await db.hotlineMessage
        .create(
          hotlineMessageFactory({
            memberPhoneNumber: undefined,
          }),
        )
        .catch(e => e)
      expect(err.message).to.contain('memberPhoneNumber cannot be null')
    })

    it('will not allow duplicate channelPhoneNumber-memberPhoneNumber combinations', async () => {
      const hm = await db.hotlineMessage.create(
        hotlineMessageFactory({ channelPhoneNumber: channel.phoneNumber }),
      )
      const err = await db.hotlineMessage
        .create(
          hotlineMessageFactory({
            channelPhoneNumber: hm.channelPhoneNumber,
            memberPhoneNumber: hm.memberPhoneNumber,
          }),
        )
        .catch(e => e)
      expect(err.errors[0].message).to.contain('channelPhoneNumber must be unique')
    })

    it('will allow duplicate chanelPhoneNumbers with different member phone numbers', async () => {
      const hm = await db.hotlineMessage.create(
        hotlineMessageFactory({ channelPhoneNumber: channel.phoneNumber }),
      )
      await db.hotlineMessage.create(
        hotlineMessageFactory({
          channelPhoneNumber: hm.channelPhoneNumber,
        }),
      )
    })

    it('provides auto-incrementing ids', async () => {
      const [hm1, hm2] = await Promise.all(
        times(2, () =>
          db.hotlineMessage.create(
            hotlineMessageFactory({ id: undefined, channelPhoneNumber: channel.phoneNumber }),
          ),
        ),
      )

      expect(hm1.id).to.be.a('number')
      expect(hm2.id).to.eql(hm1.id + 1)
    })
  })

  describe('associations', () => {
    it('belongs to a channel', async () => {
      const hm = await db.hotlineMessage.create(
        hotlineMessageFactory({ channelPhoneNumber: channel.phoneNumber }),
      )
      expect((await hm.getChannel()).phoneNumber).to.eql(channel.phoneNumber)
    })
  })
})
