import { expect } from 'chai'
import { describe, it, test, before, after, afterEach } from 'mocha'
import { keys } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { channelFactory } from '../../../support/factories/channel'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { administrationFactory } from '../../../support/factories/administration'

describe('channel model', () => {
  let db, channel
  const createChannelWithSubscriptions = () =>
    db.channel.create(
      {
        ...channelFactory(),
        subscriptions: [subscriptionFactory(), subscriptionFactory()],
      },
      {
        include: [{ model: db.subscription }],
      },
    )
  const createChannelWithAdministrations = () =>
    db.channel.create(
      {
        ...channelFactory(),
        administrations: [administrationFactory(), administrationFactory()],
      },
      {
        include: [{ model: db.administration }],
      },
    )

  before(async () => {
    db = initDb()
  })

  afterEach(() => {
    db.channel.destroy({ where: {}, force: true })
    db.subscription.destroy({ where: {}, force: true })
  })

  after(async () => {
    await db.channel.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    channel = await db.channel.create(channelFactory())

    expect(keys(channel.get())).to.have.members(['phoneNumber', 'name', 'createdAt', 'updatedAt'])
  })

  describe('validations', () => {
    it('does not allow null phone numbers', async () => {
      const err = await db.channel.create(channelFactory({ phoneNumber: null })).catch(e => e)
      expect(err.message).to.include('channel.phoneNumber cannot be null')
    })

    it('does not allow duplicate phone number', async () => {
      const attrs = channelFactory()
      const err = await db.channel.bulkCreate([attrs, attrs]).catch(e => e)
      expect(err.errors[0].message).to.eql('phoneNumber must be unique')
    })
  })

  describe('associations', () => {
    it('has many subscriptions', async () => {
      channel = await createChannelWithSubscriptions()
      expect(await channel.getSubscriptions()).to.have.length(2)
    })

    it('deletes subscriptions when it deletes channel', async () => {
      channel = await createChannelWithSubscriptions()
      const subCount = await db.subscription.count()
      await channel.destroy()

      expect(await db.channel.count()).to.eql(0)
      expect(await db.subscription.count()).to.eql(subCount - 2)
    })

    it('has many administrations', async () => {
      channel = await createChannelWithAdministrations()
      expect(await channel.getAdministrations()).to.have.length(2)
    })

    it('deletes administrations when it deletes channel', async () => {
      channel = await createChannelWithAdministrations()
      const subCount = await db.administration.count()
      await channel.destroy()

      expect(await db.channel.count()).to.eql(0)
      expect(await db.administration.count()).to.eql(subCount - 2)
    })
  })
})
