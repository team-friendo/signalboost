import { expect } from 'chai'
import { describe, it, test, before, beforeEach, after, afterEach } from 'mocha'
import { keys, times } from 'lodash'
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
  const createChannelWithMessageCount = () =>
    db.channel.create(
      {
        ...channelFactory(),
        messageCount: {},
      },
      {
        include: [{ model: db.messageCount }],
      },
    )

  before(async () => {
    db = initDb()
  })

  afterEach(() => {
    db.administration.destroy({ where: {}, force: true })
    db.messageCount.destroy({ where: {}, force: true })
    db.subscription.destroy({ where: {}, force: true })
    db.channel.destroy({ where: {}, force: true })
  })

  after(async () => {
    await db.sequelize.close()
  })

  test('fields', async () => {
    channel = await db.channel.create(channelFactory())

    expect(keys(channel.get())).to.have.members([
      'phoneNumber',
      'name',
      'containerId',
      'createdAt',
      'updatedAt',
    ])
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
    let channel, subscriptions, administrations, messageCount

    describe('subscriptions', () => {
      beforeEach(async () => {
        channel = await createChannelWithSubscriptions()
        subscriptions = await channel.getSubscriptions()
      })

      it('has many subscriptions', async () => {
        expect(subscriptions).to.have.length(2)
      })

      it('sets the channel phone number as the foreign key in each subscription', () => {
        expect(subscriptions.map(s => s.channelPhoneNumber)).to.eql(
          times(2, () => channel.phoneNumber),
        )
      })

      it('deletes subscriptions when it deletes channel', async () => {
        const subCount = await db.subscription.count()
        await channel.destroy()

        expect(await db.channel.count()).to.eql(0)
        expect(await db.subscription.count()).to.eql(subCount - 2)
      })
    })

    describe('administrations', () => {
      beforeEach(async () => {
        channel = await createChannelWithAdministrations()
        administrations = await channel.getAdministrations()
      })

      it('has many administrations', async () => {
        expect(administrations).to.have.length(2)
      })

      it('sets channel phone number as the foreign key in each administration', () => {
        expect(administrations.map(s => s.channelPhoneNumber)).to.eql(
          times(2, () => channel.phoneNumber),
        )
      })

      it('deletes administrations when it deletes channel', async () => {
        const subCount = await db.administration.count()
        await channel.destroy()

        expect(await db.channel.count()).to.eql(0)
        expect(await db.administration.count()).to.eql(subCount - 2)
      })
    })

    describe('message count', () => {
      beforeEach(async () => {
        channel = await createChannelWithMessageCount()
        messageCount = await channel.getMessageCount()
      })

      it('has one message count', async () => {
        expect(messageCount).to.exist
      })

      it('sets the channel phone number as foreign key on the message count', () => {
        expect(messageCount.channelPhoneNumber).to.eql(channel.phoneNumber)
      })

      it('sets default counts when creating empty message count', () => {
        expect(messageCount.broadcastOut).to.eql(0)
      })
    })
  })
})
