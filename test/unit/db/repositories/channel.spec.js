import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { deepChannelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { initDb } from '../../../../app/db/index'
import { omit, keys, times } from 'lodash'
import channelRepository from '../../../../app/db/repositories/channel'

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
      db.invite.destroy({ where: {}, force: true }),
      db.deauthorization.destroy({ where: {}, force: true }),
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
        expect(channel.hotlineEnabled).to.eql(false)
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
        expect(channel.hotlineEnabled).to.eql(false)
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
    const attrs = deepChannelFactory()
    let result

    beforeEach(async () => {
      channel = await db.channel.create(attrs, {
        include: [
          { model: db.deauthorization },
          { model: db.invite },
          { model: db.membership },
          { model: db.messageCount },
        ],
      })
      result = await channelRepository.findDeep(db, channel.phoneNumber)
    })

    it('retrieves all of a  channels nested attrs', () => {
      expect(result.phoneNumber).to.eql(channel.phoneNumber)
      expect(result.name).to.eql(channel.name)
    })

    it('retrieves all of a channels nested attrs', () => {
      expect(result.memberships.length).to.eql(attrs.memberships.length)
      expect(result.invites.length).to.eql(attrs.invites.length)
      expect(result.deauthorizations.length).to.eql(attrs.deauthorizations.length)
      expect(omit(result.messageCount.dataValues, ['createdAt', 'updatedAt'])).to.eql(
        attrs.messageCount,
      )
    })
  })

  describe('#findAllDeep', () => {
    const attrs = [deepChannelFactory(), deepChannelFactory()]
    let channels
    beforeEach(async () => {
      await Promise.all(
        attrs.map(x =>
          db.channel.create(x, {
            include: [
              { model: db.deauthorization },
              { model: db.invite },
              { model: db.membership },
              { model: db.messageCount },
            ],
          }),
        ),
      )
      channels = await channelRepository.findAllDeep(db)
    })

    it('fetches each channel', () => {
      expect(channels.length).to.eql(attrs.length)
    })

    it('fetches all attributes and nested resources for each channel', () => {
      channels.forEach(ch => {
        expect(keys(ch.toJSON())).to.eql([
          'phoneNumber',
          'name',
          'description',
          'messageExpiryTime',
          'hotlineEnabled',
          'vouchingOn',
          'createdAt',
          'updatedAt',
          'deauthorizations',
          'invites',
          'memberships',
          'messageCount',
        ])
      })
    })
  })
})
