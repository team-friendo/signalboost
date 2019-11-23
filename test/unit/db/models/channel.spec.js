import { expect } from 'chai'
import { describe, it, test, before, beforeEach, after, afterEach } from 'mocha'
import { keys, times } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { channelFactory } from '../../../support/factories/channel'
import { membershipFactory } from '../../../support/factories/membership'

describe('channel model', () => {
  let db, channel

  const createChannelWithSubscriptions = () =>
    db.channel.create(
      {
        ...channelFactory(),
        memberships: [membershipFactory(), membershipFactory()],
      },
      {
        include: [{ model: db.membership }],
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
    db.messageCount.destroy({ where: {}, force: true })
    db.membership.destroy({ where: {}, force: true })
    db.channel.destroy({ where: {}, force: true })
  })

  after(async () => {
    await db.sequelize.close()
  })

  test('fields', async () => {
    channel = await db.channel.create(channelFactory())

    it('has correct fields', () => {
      expect(keys(channel.get())).to.have.members([
        'phoneNumber',
        'name',
        'responsesEnabled',
        'createdAt',
        'updatedAt',
      ])
    })

    it('sets correct defaults', () => {
      expect(channel.responsesEnabled).to.equal(false)
    })
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
    let channel, messageCount, memberships

    describe('memberships', () => {
      beforeEach(async () => {
        channel = await createChannelWithSubscriptions()
        memberships = await channel.getMemberships()
      })

      it('has many memberships', async () => {
        expect(memberships).to.have.length(2)
      })

      it('sets the channel phone number as the foreign key in each membership', () => {
        expect(memberships.map(s => s.channelPhoneNumber)).to.eql(
          times(2, () => channel.phoneNumber),
        )
      })

      it('deletes memberships when it deletes channel', async () => {
        const membershipCount = await db.membership.count()
        await channel.destroy()
        expect(await db.membership.count()).to.eql(membershipCount - 2)
      })
    })

    describe('message count', () => {
      beforeEach(async () => {
        channel = await createChannelWithMessageCount()
        messageCount = await channel.getMessageCount()
      })

      it('has one message count', async () => {
        expect(messageCount).to.be.an('object')
      })

      it('sets the channel phone number as foreign key on the message count', () => {
        expect(messageCount.channelPhoneNumber).to.eql(channel.phoneNumber)
      })

      it('sets default counts when creating empty message count', () => {
        expect(messageCount.broadcastOut).to.eql(0)
      })

      it('deletes message count when it deletes channel', async () => {
        const messageCountCount = await db.messageCount.count()
        await channel.destroy()
        expect(await db.messageCount.count()).to.eql(messageCountCount - 1)
      })
    })
  })
})
