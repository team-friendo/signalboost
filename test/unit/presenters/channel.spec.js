import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { initDb } from '../../../app/db'
import channelPresenters from '../../../app/presenters/channel'
import { deepChannelAttrs } from '../../support/factories/channel'

describe('channel presenters', () => {
  let db
  before(() => (db = initDb()))
  after(async () => {
    await Promise.all([
      db.administration.destroy({ where: {} }),
      db.subscription.destroy({ where: {} }),
      db.messageCount.destroy({ where: {} }),
      db.welcome.destroy({ where: {} }),
      db.channel.destroy({ where: {} }),
    ])
    await db.sequelize.close()
  })

  describe('#list', () => {
    let channels
    before(async () => {
      channels = await Promise.all(
        deepChannelAttrs.map(ch =>
          db.channel.create(ch, {
            include: [
              { model: db.subscription },
              { model: db.administration },
              { model: db.messageCount },
              { model: db.welcome },
            ],
          }),
        ),
      )
    })

    it('removes extraneous fields from a deeply nested channel resource', () => {
      expect(channelPresenters.list(channels)).to.eql({
        count: 2,
        channels: [
          {
            name: 'foo',
            phoneNumber: '+11111111111',
            admins: 2,
            subscribers: 2,
            messageCount: { broadcastOut: 4, commandIn: 5 },
          },
          {
            name: 'bar',
            phoneNumber: '+19999999999',
            admins: 1,
            subscribers: 1,
            messageCount: { broadcastOut: 100, commandIn: 20 },
          },
        ],
      })
    })
  })
})
