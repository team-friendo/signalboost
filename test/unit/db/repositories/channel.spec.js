import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { initDb } from '../../../../app/db/index'
import { pick, keys, times } from 'lodash'
import channelRepository from '../../../../app/db/repositories/channel'
import { memberTypes } from '../../../../app/db/repositories/membership'
import { deepChannelAttrs } from '../../../support/factories/channel'

describe('channel repository', () => {
  chai.use(chaiAsPromised)

  const channelPhoneNumber = genPhoneNumber()
  const adminPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  let db, channel

  before(() => (db = initDb()))
  afterEach(async () => {
    await Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.membership.destroy({ where: {}, force: true }),
      db.messageCount.destroy({ where: {}, force: true }),
    ])
  })
  after(async () => await db.sequelize.close())

  describe('#create', () => {
    let channel, channelCount, messageCountCount, membershipCount

    describe('when given phone number for a non-existent channel and two admins', () => {
      beforeEach(async () => {
        channelCount = await db.channel.count()
        messageCountCount = await db.messageCount.count()
        membershipCount = await db.membership.count()
        channel = await channelRepository.create(
          db,
          channelPhoneNumber,
          '#blackops',
          adminPhoneNumbers,
        )
      })

      it('creates a new channel', async () => {
        expect(await db.channel.count()).to.eql(channelCount + 1)
      })

      it('creates an empty messageCount record for the channel', async () => {
        expect(await db.messageCount.count()).to.eql(messageCountCount + 1)
        expect(
          await db.messageCount.findOne({
            where: { channelPhoneNumber: channel.phoneNumber },
          }),
        ).to.be.an('object')
      })

      it('creates two publication records', async () => {
        expect(await db.membership.count()).to.eql(membershipCount + 2)
      })

      it('returns the channel record', () => {
        expect(channel.phoneNumber).to.eql(channelPhoneNumber)
        expect(channel.name).to.eql('#blackops')
        expect(channel.responsesEnabled).to.eql(false)
        expect(channel.memberships.map(m => m.memberPhoneNumber)).to.eql(adminPhoneNumbers)
        expect(channel.messageCount).to.be.an('object')
      })
    })

    describe('when given phone number for a already-existing channel', () => {
      let newAdminPhoneNumbers = times(2, genPhoneNumber)
      beforeEach(async () => {
        await channelRepository.create(db, channelPhoneNumber, '#foursquare', newAdminPhoneNumbers)
        channelCount = await db.channel.count()
        messageCountCount = await db.messageCount.count()
        membershipCount = await db.membership.count()
        channel = await channelRepository.create(
          db,
          channelPhoneNumber,
          '#blackops',
          newAdminPhoneNumbers,
        )
      })

      it('does not create a new channel', async () => {
        expect(await db.channel.count()).to.eql(channelCount)
      })

      it('does not create a new messageCount record', async () => {
        expect(await db.messageCount.count()).to.eql(messageCountCount)
      })

      it('updates the channel record and returns it', async () => {
        expect(channel.phoneNumber).to.eql(channelPhoneNumber)
        expect(channel.name).to.eql('#blackops')
        expect(channel.responsesEnabled).to.eql(false)
        expect((await channel.memberships).map(m => m.memberPhoneNumber)).to.have.members(
          newAdminPhoneNumbers,
        )
      })
    })
  })

  describe('#update', () => {
    let updatedChannel
    beforeEach(async () => {
      await db.channel.create({ phoneNumber: channelPhoneNumber, name: 'foo' })
      updatedChannel = await channelRepository.update(db, channelPhoneNumber, { name: 'bar' })
    })

    it("updates a channel's name", async () => {
      const newName = await db.channel
        .findOne({ where: { phoneNumber: channelPhoneNumber } })
        .then(ch => ch.name)
      expect(newName).to.eql('bar')
    })

    it('returns a channel resources with updated values', () => {
      expect(updatedChannel.name).to.eql('bar')
    })
  })

  describe('#findDeep', () => {
    const adminNumbers = [genPhoneNumber(), genPhoneNumber()]
    const subscriberNumbers = [genPhoneNumber(), genPhoneNumber()]
    let result

    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory(),
          memberships: [
            ...subscriberNumbers.map(num => ({
              type: memberTypes.SUBSCRIBER,
              memberPhoneNumber: num,
            })),
            ...adminNumbers.map(num => ({ type: memberTypes.ADMIN, memberPhoneNumber: num })),
          ],
        },
        {
          include: [{ model: db.membership }],
        },
      )
      result = await channelRepository.findDeep(db, channel.phoneNumber)
    })

    it('retrieves a channel', () => {
      expect(result.phoneNumber).to.eql(channel.phoneNumber)
      expect(result.name).to.eql(channel.name)
    })

    it("retrieves the channel's memberships", () => {
      expect(
        result.memberships.map(a =>
          pick(a.get(), ['type', 'channelPhoneNumber', 'memberPhoneNumber']),
        ),
      ).to.have.deep.members([
        {
          type: memberTypes.ADMIN,
          channelPhoneNumber: channel.phoneNumber,
          memberPhoneNumber: adminNumbers[0],
        },
        {
          type: memberTypes.ADMIN,
          channelPhoneNumber: channel.phoneNumber,
          memberPhoneNumber: adminNumbers[1],
        },
        {
          type: memberTypes.SUBSCRIBER,
          channelPhoneNumber: channel.phoneNumber,
          memberPhoneNumber: subscriberNumbers[0],
        },
        {
          type: memberTypes.SUBSCRIBER,
          channelPhoneNumber: channel.phoneNumber,
          memberPhoneNumber: subscriberNumbers[1],
        },
      ])
    })
  })

  describe('#findAllDeep', () => {
    let channels
    beforeEach(async () => {
      await Promise.all(
        deepChannelAttrs.map(ch =>
          db.channel.create(
            { ...ch, phoneNumber: genPhoneNumber() },
            {
              include: [{ model: db.membership }, { model: db.messageCount }],
            },
          ),
        ),
      )
      channels = await channelRepository.findAllDeep(db)
    })

    it('fetches all channels', () => {
      expect(channels.length).to.eql(deepChannelAttrs.length)
    })

    it('fetches all attributes and nested resources for each channel', () => {
      channels.forEach(ch => {
        expect(keys(ch.toJSON())).to.have.eql([
          'phoneNumber',
          'name',
          'responsesEnabled',
          'vouchingOn',
          'createdAt',
          'updatedAt',
          'memberships',
          'messageCount',
        ])
      })
    })

    it('orders channels by broadcast out message count (descending)', () => {
      expect(channels[0].messageCount.broadcastOut).to.eql(100)
    })
  })
})
