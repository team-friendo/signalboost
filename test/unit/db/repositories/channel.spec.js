import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import { omit, keys, times, map } from 'lodash'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import util from '../../../../app/util'
import channelRepository from '../../../../app/db/repositories/channel'
import dbService from '../../../../app/db'
import { channelFactory, deepChannelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { membershipFactory } from '../../../support/factories/membership'

const {
  jobs: { channelExpiryInMillis },
  signal: { diagnosticsPhoneNumber, supportPhoneNumber },
} = require('../../../../app/config')

describe('channel repository', () => {
  const createChannelsFromAttributes = attrs =>
    Promise.all(
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

  const channelPhoneNumber = genPhoneNumber()
  const adminPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  let db, channel

  const createDiagnosticsChannel = async () =>
    db.channel.create(deepChannelFactory({ phoneNumber: diagnosticsPhoneNumber }), {
      include: [{ model: db.membership }],
    })

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
  })
  afterEach(async () => {
    await Promise.all([
      db.destructionRequest.destroy({ where: {} }),
      db.membership.destroy({ where: {}, force: true }),
      db.messageCount.destroy({ where: {}, force: true }),
      db.invite.destroy({ where: {}, force: true }),
      db.deauthorization.destroy({ where: {}, force: true }),
    ])
    await db.channel.destroy({ where: {}, force: true })
  })
  after(async () => await app.stop())

  describe('#create', () => {
    let channel, channelCount, messageCountCount, membershipCount

    describe('when given phone number for a non-existent channel and two admins', () => {
      beforeEach(async () => {
        channelCount = await db.channel.count()
        messageCountCount = await db.messageCount.count()
        membershipCount = await db.membership.count()
        channel = await channelRepository.create(channelPhoneNumber, '#blackops', adminPhoneNumbers)
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

      it('creates two membership records', async () => {
        expect(await db.membership.count()).to.eql(membershipCount + 2)
      })

      it('assigns an adminId to each new admin', async () => {
        channel.memberships.forEach((membership, idx) => {
          expect(membership.adminId).to.eql(idx + 1)
        })
      })

      it("updates the channel's nextAdminId", async () => {
        expect(channel.nextAdminId).to.eql((await db.membership.count()) + 1)
      })

      it('returns the channel record', () => {
        expect(channel.phoneNumber).to.eql(channelPhoneNumber)
        expect(channel.name).to.eql('#blackops')
        expect(channel.hotlineOn).to.eql(true)
        expect(channel.memberships.map(m => m.memberPhoneNumber)).to.eql(adminPhoneNumbers)
        expect(channel.messageCount).to.be.an('object')
      })
    })

    describe('when given phone number for a already-existing channel', () => {
      let newAdminPhoneNumbers = times(2, genPhoneNumber)
      beforeEach(async () => {
        await channelRepository.create(channelPhoneNumber, '#foursquare', newAdminPhoneNumbers)
        channelCount = await db.channel.count()
        messageCountCount = await db.messageCount.count()
        membershipCount = await db.membership.count()
        channel = await channelRepository.create(
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
        expect(channel.hotlineOn).to.eql(true)
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
      updatedChannel = await channelRepository.update(channelPhoneNumber, { name: 'bar' })
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

  describe('#destroy', () => {
    let channel, channelCount

    describe('when given the phone number for an existing channel', () => {
      beforeEach(async () => {
        channel = await db.channel.create(deepChannelFactory(), {
          include: [{ model: db.membership }],
        })
      })

      it('deletes the instance and its associations', async () => {
        channelCount = await db.channel.count()
        expect(await channelRepository.destroy(channel.phoneNumber)).to.eql(true)
        expect(await db.channel.count()).to.eql(channelCount - 1)
        expect(await db.membership.findOne({ where: { channelPhoneNumber: channel.phoneNumber } }))
          .to.be.null
      })
    })

    describe('when given the phone number for a non-existent channel', () => {
      it('does nothing', async () => {
        channelCount = await db.channel.count()
        expect(await channelRepository.destroy(genPhoneNumber())).to.eql(false)
        expect(await db.channel.count()).to.eql(channelCount)
      })
    })
  })

  describe('#findDeep', () => {
    const attrs = deepChannelFactory()
    let result

    describe("when channel's associons have values", () => {
      beforeEach(async () => {
        channel = await db.channel.create(attrs, {
          include: [
            { model: db.deauthorization },
            { model: db.invite },
            { model: db.membership },
            { model: db.messageCount },
            { model: db.destructionRequest },
          ],
        })
        result = await channelRepository.findDeep(channel.phoneNumber)
      })

      it("retrieves all of a channel's fields", () => {
        expect(result.phoneNumber).to.eql(channel.phoneNumber)
        expect(result.name).to.eql(channel.name)
      })

      it("retrieves all of a channel's nested attributes", () => {
        expect(result.deauthorizations.length).to.eql(attrs.deauthorizations.length)
        expect(result.invites.length).to.eql(attrs.invites.length)
        expect(result.memberships.length).to.eql(attrs.memberships.length)
        expect(omit(result.messageCount.dataValues, ['createdAt', 'updatedAt'])).to.eql(
          attrs.messageCount,
        )
        expect(result.destructionRequest.channelPhoneNumber).to.eql(channel.phoneNumber)
      })
    })

    describe("when channel's associations are empty", () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory(), {
          include: [
            { model: db.deauthorization },
            { model: db.invite },
            { model: db.membership },
            { model: db.messageCount },
            { model: db.destructionRequest },
          ],
        })
        result = await channelRepository.findDeep(channel.phoneNumber)
      })

      it("retrieves empty values for channel's nested attributes", () => {
        expect(result.deauthorizations).to.eql([])
        expect(result.invites).to.eql([])
        expect(result.memberships).to.eql([])
        expect(result.messageCount).to.be.null
        expect(result.destructionRequest).to.be.null
      })
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
              { model: db.destructionRequest },
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
        expect(keys(ch.toJSON())).to.have.members([
          'phoneNumber',
          'name',
          'messageExpiryTime',
          'hotlineOn',
          'vouchMode',
          'vouchLevel',
          'nextAdminId',
          'createdAt',
          'updatedAt',
          'deauthorizations',
          'invites',
          'memberships',
          'messageCount',
          'destructionRequest',
          'socketId',
          'subscriberLimit',
        ])
      })
    })
  })

  describe('#findManyDeep', () => {
    const includedPhoneNumbers = times(2, genPhoneNumber)
    const excludesPhoneNumbers = times(3, genPhoneNumber)

    beforeEach(async () => {
      await Promise.all(
        [...includedPhoneNumbers, ...excludesPhoneNumbers].map(phoneNumber =>
          db.channel.create(deepChannelFactory({ phoneNumber }), {
            include: [{ model: db.membership }],
          }),
        ),
      )
    })
    it('retrieves all channels with given phone numbers', async () => {
      const results = await channelRepository.findManyDeep(includedPhoneNumbers)
      expect(map(results, 'phoneNumber')).to.have.members(includedPhoneNumbers)
      expect(results[0].memberships).not.to.be.empty
    })
  })

  describe('#getDiagnosticsChannel', () => {
    it('returns the diagnostics channel and its deep attributes', async () => {
      const diagnosticsChannel = await createDiagnosticsChannel()
      const foundChannel = await channelRepository.getDiagnosticsChannel()
      expect(foundChannel.phoneNumber).to.eql(diagnosticsChannel.phoneNumber)
      expect(foundChannel.memberships.length).to.eql(diagnosticsChannel.memberships.length)
    })
  })

  describe('#getChannelsSortedBySize', () => {
    let channels
    beforeEach(async () => {
      channels = await createChannelsFromAttributes([
        deepChannelFactory({ memberships: times(2, membershipFactory) }),
        deepChannelFactory({ memberships: times(8, membershipFactory) }),
        deepChannelFactory({ memberships: times(4, membershipFactory) }),
        deepChannelFactory({ memberships: [] }),
      ])
    })

    it('returns a list of (channelPhoneNumber, channelSize) tuples sorted in descending order of channelSize', async () => {
      expect(await channelRepository.getChannelsSortedBySize()).to.eql([
        [channels[1].phoneNumber, 8],
        [channels[2].phoneNumber, 4],
        [channels[0].phoneNumber, 2],
        [channels[3].phoneNumber, 0],
      ])
    })
  })

  describe('#udpateSocketPools', () => {
    const updatedChannelPhoneNumbers = times(3, genPhoneNumber)
    const unaffectedPhoneNumber = genPhoneNumber()
    const updatedSocketId = 42
    const unaffectedSocketId = 99

    beforeEach(async () => {
      await Promise.all([
        db.channel.create(channelFactory({ phoneNumber: unaffectedPhoneNumber, socketId: 99 })),
        ...updatedChannelPhoneNumbers.map((phoneNumber, idx) =>
          db.channel.create(channelFactory({ phoneNumber, socketId: idx })),
        ),
      ])
    })

    it('updates many channels to have the same socket pool id', async () => {
      await channelRepository.updateSocketIds(updatedChannelPhoneNumbers, 42)

      expect((await channelRepository.findByPhoneNumber(unaffectedPhoneNumber)).socketId).to.eql(
        unaffectedSocketId,
      )

      expect(
        map(await channelRepository.findManyDeep(updatedChannelPhoneNumbers), 'socketId'),
      ).to.eql(times(3, () => updatedSocketId))
    })
  })

  describe('#isMaintainer', () => {
    let diagnosticsChannel, adminPhoneNumber, subscriberPhoneNumber

    beforeEach(async () => {
      diagnosticsChannel = await createDiagnosticsChannel()
      adminPhoneNumber = diagnosticsChannel.memberships[0].memberPhoneNumber
      subscriberPhoneNumber = diagnosticsChannel.memberships[2].memberPhoneNumber
    })

    it('returns true for an admin for the diagnostics channel', async () => {
      expect(await channelRepository.isMaintainer(adminPhoneNumber)).to.eql(true)
    })

    it('returns false for a subscriber to the diagnostics channel', async () => {
      expect(await channelRepository.isMaintainer(subscriberPhoneNumber)).to.eql(false)
    })

    it('returns false for a random number', async () => {
      expect(await channelRepository.isMaintainer(genPhoneNumber())).to.eql(false)
    })
  })

  describe('#getMaintainers', () => {
    it('returns the admins of the diagnostics channel', async () => {
      const diagnosticsChannel = await createDiagnosticsChannel()
      expect(map(await channelRepository.getMaintainers(), 'memberPhoneNumber')).to.have.members(
        map(diagnosticsChannel.memberships.slice(0, 2), 'memberPhoneNumber'),
      )
    })
  })

  describe('#getStaleChannels', () => {
    let allChannels, staleChannels

    beforeEach(async () => {
      allChannels = await createChannelsFromAttributes([
        ...times(2, deepChannelFactory),
        deepChannelFactory({ phoneNumber: diagnosticsPhoneNumber }),
        deepChannelFactory({ phoneNumber: supportPhoneNumber }),
      ])
      staleChannels = allChannels.slice(0, 2)

      await util.wait(channelExpiryInMillis + 1)
      await createChannelsFromAttributes(times(1, deepChannelFactory))
    })

    it('returns all channels who have not used in the TTL period (1 week) - except SUPPORT & DIAGNOSTICS', async () => {
      const fetchedStaleChannels = await channelRepository.getStaleChannels()
      expect(fetchedStaleChannels.length).to.eql(2)
      expect(map(fetchedStaleChannels, 'phoneNumber')).to.eql(map(staleChannels, 'phoneNumber'))
    })
  })

  describe('selectors', () => {
    describe('#canAddSubscribers', () => {
      beforeEach(async () => {
        ;[channel] = await createChannelsFromAttributes([
          deepChannelFactory({ subscriberLimit: 4 }),
        ])
        expect(channelRepository.getSubscriberMemberships(channel).length).to.eql(2)
      })

      it('returns false when num subscribers exceeds subscriber limit', () => {
        expect(channelRepository.canAddSubscribers(channel, 3)).to.eql(false)
      })

      it('returns true when num subscribers does not exceed subscriber limit', () => {
        expect(channelRepository.canAddSubscribers(channel, 2)).to.eql(true)
        expect(channelRepository.canAddSubscribers(channel, 1)).to.eql(true)
      })

      it('sets num subscribers to 1 if none provided', () => {
        expect(channelRepository.canAddSubscribers(channel)).to.eql(true)
      })
    })
  })
})
