import { expect } from 'chai'
import { describe, it, before, beforeEach, afterEach, after } from 'mocha'
import { initDb } from '../../../../app/db/index'
import { messageCountFactory } from '../../../support/factories/messageCount'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import messageCountRepository from '../../../../app/db/repositories/messageCount'
import { channelFactory } from '../../../support/factories/channel'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { times } from 'lodash'

describe('message count repository', () => {
  const channelPhoneNumber = genPhoneNumber()
  let db, countBefore, countAfter

  before(() => (db = initDb()))
  afterEach(() => {
    db.messageCount.destroy({ where: {} })
    db.subscription.destroy({ where: {} })
    db.channel.destroy({ where: {} })
  })
  after(async () => await db.sequelize.close())

  describe('#incrementBroadcastCount', () => {
    beforeEach(async () => {
      db.channel.create(
        { ...channelFactory(), subscriptions: times(3, subscriptionFactory) },
        { include: [{ model: db.subscription }] },
      )
      countBefore = await db.messageCount.create(messageCountFactory({ channelPhoneNumber }))
      countAfter = await messageCountRepository.incrementBroadcastCount(db, channelPhoneNumber, 4)
    })

    it('updates the broadcastIn count by 1', () => {
      expect(countAfter.broadcastIn).to.eql(countBefore.broadcastIn + 1)
    })

    it('updates the broadcastOutCount by N, where N is number of channel subscribers', () => {
      expect(countAfter.broadcastOut).to.eql(countBefore.broadcastOut + 4)
    })
  })

  describe('#incrementBroadcastCount', () => {
    beforeEach(async () => {
      db.channel.create(
        { ...channelFactory(), subscriptions: times(3, subscriptionFactory) },
        { include: [{ model: db.subscription }] },
      )
      countBefore = await db.messageCount.create(messageCountFactory({ channelPhoneNumber }))
      countAfter = await messageCountRepository.incrementCommandCount(db, channelPhoneNumber)
    })

    it('updates the commandIn count by 1', () => {
      expect(countAfter.commandIn).to.eql(countBefore.commandIn + 1)
    })

    it('updates the commandOut count by 1', () => {
      expect(countAfter.commandOut).to.eql(countBefore.commandOut + 1)
    })
  })
})
