import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { initDb } from '../../../../app/db/index'
import { pick, omit, keys, times } from 'lodash'
import channelRepository from '../../../../app/db/repositories/channel'
import { deepChannelAttrs } from '../../../support/factories/channel'

describe('channel repository', () => {
  chai.use(chaiAsPromised)

  const channelPhoneNumber = genPhoneNumber()
  const publisherPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  let db, channel

  before(() => (db = initDb()))
  afterEach(async () => {
    await Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.publication.destroy({ where: {}, force: true }),
      db.subscription.destroy({ where: {}, force: true }),
      db.messageCount.destroy({ where: {}, force: true }),
    ])
  })
  after(async () => await db.sequelize.close())

  describe('#create', () => {
    let channel, channelCount, messageCountCount, publicationCount

    describe('when given phone number for a non-existent channel and two publishers', () => {
      beforeEach(async () => {
        channelCount = await db.channel.count()
        messageCountCount = await db.messageCount.count()
        publicationCount = await db.publication.count()
        channel = await channelRepository.create(
          db,
          channelPhoneNumber,
          '#blackops',
          publisherPhoneNumbers,
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
        expect(await db.publication.count()).to.eql(publicationCount + 2)
      })

      it('returns the channel record', () => {
        expect(
          omit(channel.get(), [
            'createdAt',
            'updatedAt',
            'messageCount',
            'containerId', // TODO: drop containerId from schema!
            'publications',
          ]),
        ).to.eql({
          phoneNumber: channelPhoneNumber,
          name: '#blackops',
          responsesEnabled: false,
        })
        expect(channel.publications.map(p => p.publisherPhoneNumber)).to.eql(publisherPhoneNumbers)
        expect(channel.messageCount).to.be.an('object')
      })
    })

    describe('when given phone number for a already-existing channel', () => {
      let newPublisherPNums = times(2, genPhoneNumber)
      beforeEach(async () => {
        await channelRepository.create(db, channelPhoneNumber, '#foursquare', newPublisherPNums)
        channelCount = await db.channel.count()
        messageCountCount = await db.messageCount.count()
        publicationCount = await db.publication.count()
        channel = await channelRepository.create(
          db,
          channelPhoneNumber,
          '#blackops',
          newPublisherPNums,
        )
      })

      it('does not create a new channel', async () => {
        expect(await db.channel.count()).to.eql(channelCount)
      })

      it('does not create a new messageCount record', async () => {
        expect(await db.messageCount.count()).to.eql(messageCountCount)
      })

      it('updates the channel record and returns it', async () => {
        expect(omit(channel, ['createdAt', 'updatedAt', 'messageCount', 'publications'])).to.eql({
          phoneNumber: channelPhoneNumber,
          name: '#blackops',
          responsesEnabled: false,
        })
        expect((await channel.publications).map(p => p.publisherPhoneNumber)).to.have.members(
          newPublisherPNums,
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
    const publisherNumbers = [genPhoneNumber(), genPhoneNumber()]
    const subscriberNumbers = [genPhoneNumber(), genPhoneNumber()]
    let result

    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory(),
          subscriptions: subscriberNumbers.map(num => ({ subscriberPhoneNumber: num })),
          publications: publisherNumbers.map(num => ({ publisherPhoneNumber: num })),
        },
        {
          include: [{ model: db.subscription }, { model: db.publication }],
        },
      )
      result = await channelRepository.findDeep(db, channel.phoneNumber)
    })

    it('retrieves a channel', () => {
      expect(result.phoneNumber).to.eql(channel.phoneNumber)
      expect(result.name).to.eql(channel.name)
    })

    it("retrieves the channel's publications", () => {
      expect(
        result.publications.map(a => pick(a.get(), ['channelPhoneNumber', 'publisherPhoneNumber'])),
      ).to.have.deep.members([
        { channelPhoneNumber: channel.phoneNumber, publisherPhoneNumber: publisherNumbers[0] },
        { channelPhoneNumber: channel.phoneNumber, publisherPhoneNumber: publisherNumbers[1] },
      ])
    })

    it("retrieves the channel's subscriptions", () => {
      expect(
        result.subscriptions.map(a =>
          pick(a.get(), ['channelPhoneNumber', 'subscriberPhoneNumber']),
        ),
      ).to.have.deep.members([
        {
          channelPhoneNumber: channel.phoneNumber,
          subscriberPhoneNumber: subscriberNumbers[0],
        },
        {
          channelPhoneNumber: channel.phoneNumber,
          subscriberPhoneNumber: subscriberNumbers[1],
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
              include: [
                { model: db.subscription },
                { model: db.publication },
                { model: db.messageCount },
              ],
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
        expect(keys(ch.toJSON())).to.eql([
          'phoneNumber',
          'name',
          'responsesEnabled',
          'createdAt',
          'updatedAt',
          'subscriptions',
          'publications',
          'messageCount',
        ])
      })
    })

    it('orders channels by broadcast out message count (descending)', () => {
      expect(channels[0].messageCount.broadcastOut).to.eql(100)
    })
  })
  
})
