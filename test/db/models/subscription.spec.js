import { expect } from 'chai'
import { describe, it, test, before, after } from 'mocha'
import { keys } from 'lodash'
import { initDb } from '../../../app/db'
import { subscriptionFactory } from '../../support/factories/subscription'
import { channelFactory } from '../../support/factories/channel'
import { phoneNumberFactory } from '../../support/factories/phoneNumber'

describe('subscription model', () => {
  let db, subscription

  before(async () => {
    db = initDb()
  })

  after(async () => {
    await db.subscription.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    subscription = await db.subscription.create(subscriptionFactory())
    expect(keys(subscription.get())).to.have.members([
      'id',
      'channelPhoneNumber',
      'humanPhoneNumber',
      'createdAt',
      'updatedAt',
    ])
  })

  describe('associations', () => {
    before(async () => {
      const channel = await db.channel.create(channelFactory())
      subscription = await db.subscription.create({
        humanPhoneNumber: phoneNumberFactory(),
        channelPhoneNumber: channel.phoneNumber,
      })
    })

    it('belongs to a channel', async () => {
      expect(await subscription.getChannel()).to.exist
    })
  })
})
