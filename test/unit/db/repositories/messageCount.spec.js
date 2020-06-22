import { expect } from 'chai'
import { describe, it, before, beforeEach, afterEach, after } from 'mocha'
import { messageCountFactory } from '../../../support/factories/messageCount'
import messageCountRepository from '../../../../app/db/repositories/messageCount'
import { deepChannelFactory } from '../../../support/factories/channel'
import { getAdminMemberships } from '../../../../app/db/repositories/channel'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'

describe('message count repository', () => {
  const channel = deepChannelFactory()
  const channelPhoneNumber = channel.phoneNumber
  let db, countBefore, countAfter

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
  })
  afterEach(() => {
    db.messageCount.destroy({ where: {} })
    db.membership.destroy({ where: {} })
    db.channel.destroy({ where: {} })
  })
  after(async () => await app.stop())

  describe('#countBroadcast', () => {
    beforeEach(async () => {
      countBefore = await db.messageCount.create(messageCountFactory({ channelPhoneNumber }))
      countAfter = await messageCountRepository.countBroadcast(channel)
    })

    it('updates the broadcastIn count by 1', () => {
      expect(countAfter.broadcastIn).to.eql(countBefore.broadcastIn + 1)
    })

    it('updates the broadcastOutCount by N, where N is number of channel members', () => {
      expect(countAfter.broadcastOut).to.eql(countBefore.broadcastOut + channel.memberships.length)
    })
  })

  describe('#countCommand', () => {
    beforeEach(async () => {
      countBefore = await db.messageCount.create(messageCountFactory({ channelPhoneNumber }))
      countAfter = await messageCountRepository.countCommand(channel)
    })

    it('updates the commandIn count by 1', () => {
      expect(countAfter.commandIn).to.eql(countBefore.commandIn + 1)
    })

    it('updates the commandOut count by 1', () => {
      expect(countAfter.commandOut).to.eql(countBefore.commandOut + 1)
    })
  })

  describe('#countHotline', () => {
    beforeEach(async () => {
      countBefore = await db.messageCount.create(messageCountFactory({ channelPhoneNumber }))
      countAfter = await messageCountRepository.countHotline(channel)
    })

    it('updates the hotlineIn count by 1', () => {
      expect(countAfter.hotlineIn).to.eql(countBefore.hotlineIn + 1)
    })

    it('updates the hotlineOutCount by N, where N is number of channel admins', () => {
      expect(countAfter.hotlineOut).to.eql(
        countBefore.hotlineOut + getAdminMemberships(channel).length,
      )
    })
  })
})
