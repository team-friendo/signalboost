import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { keys, values, pick } from 'lodash'
import { run } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { messageCountFactory } from '../../../support/factories/messageCount'
import { channelFactory } from '../../../support/factories/channel'

describe('messageCount model', () => {
  let db, messageCount

  before(async () => {
    db = await run()
  })

  after(async () => {
    await db.messageCount.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.stop()
  })

  it('has correct fields', async () => {
    messageCount = await db.messageCount.create(messageCountFactory())
    expect(keys(messageCount.get())).to.eql([
      'channelPhoneNumber',
      'broadcastIn',
      'broadcastOut',
      'hotlineIn',
      'hotlineOut',
      'commandIn',
      'commandOut',
      'updatedAt',
      'createdAt',
    ])
  })

  describe('defaults', () => {
    it('sets all counts to 0 if no value is provided', async () => {
      messageCount = await db.messageCount.create(
        messageCountFactory({
          broadcastIn: undefined,
          broadcastOut: undefined,
          hotlineIn: undefined,
          hotlineOut: undefined,
          commandIn: undefined,
          commandOut: undefined,
        }),
      )
      ;[
        'broadcastIn',
        'broadcastOut',
        'hotlineIn',
        'hotlineOut',
        'commandIn',
        'commandOut',
      ].forEach(attr => expect(messageCount[attr]).to.eql(0))
    })
  })

  describe('validations', () => {
    it('does not allow null phone numbers', async () => {
      const err = await db.messageCount.create({ phoneNumber: null }).catch(e => e)
      expect(err.message).to.include('channelPhoneNumber cannot be null')
    })

    it('provides default values for all counts', async () => {
      const result = await db.messageCount.create({ channelPhoneNumber: genPhoneNumber() })
      expect(
        values(pick(result, ['broadcastIn', 'broadcastOut', 'commandIn', 'commandOut'])),
      ).to.eql([0, 0, 0, 0])
    })
  })

  describe('associations', () => {
    it('belongs to a channel', async () => {
      const channel = await db.channel.create(channelFactory())
      const message = await db.messageCount.create({ channelPhoneNumber: channel.phoneNumber })
      expect(await message.getChannel().then(c => c.get())).to.eql(channel.get())
    })
  })
})
