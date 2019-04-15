import { expect } from 'chai'
import { describe, it, test, before, after } from 'mocha'
import { keys, values, pick } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { messageCountFactory } from '../../../support/factories/messageCount'
import { channelFactory } from '../../../support/factories/channel'

describe('messageCount model', () => {
  let db, messageCount

  before(async () => {
    db = initDb()
  })

  after(async () => {
    await db.messageCount.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    messageCount = await db.messageCount.create(messageCountFactory())
    expect(keys(messageCount.get())).to.have.deep.members([
      'channelPhoneNumber',
      'broadcastIn',
      'broadcastOut',
      'commandIn',
      'commandOut',
      'createdAt',
      'updatedAt',
    ])
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
