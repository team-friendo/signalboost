import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { pick } from 'lodash'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { initDb } from '../../../../app/db/index'
import { omit, keys, times } from 'lodash'
import channelRepository from '../../../../app/db/repositories/channel'
import { publicationFactory } from '../../../support/factories/publication'
import { deepChannelAttrs } from '../../../support/factories/channel'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { senderTypes } from '../../../../app/constants'

describe('channel repository', () => {
  chai.use(chaiAsPromised)

  const channelPhoneNumber = genPhoneNumber()
  const subscriberPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  const publisherPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  let db, channel, sub, subCount, publisherCount, publishers

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
        expect((await channel.getPublications()).map(p => p.publisherPhoneNumber)).to.have.members(
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

  describe('#addPublishers', () => {
    describe('when given the pNum of an existing channel and a new human', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        subCount = await db.subscription.count()
        publisherCount = await db.publication.count()
        publishers = await channelRepository.addPublishers(
          db,
          channel.phoneNumber,
          publisherPhoneNumbers,
        )
      })

      it('creates 2 new publications', async () => {
        expect(await db.publication.count()).to.eql(publisherCount + 2)
      })

      it('associates the publications with the channel', async () => {
        const fetchedPublishers = await channel.getPublications()
        expect(fetchedPublishers.map(a => a.get())).to.have.deep.members(
          publishers.map(a => a.get()),
        )
      })

      it('creates no new subscriptions', async () => {
        expect(await db.subscription.count()).to.eql(subCount)
      })

      it('returns an publication joining the channel to the human', () => {
        publishers.forEach((publisher, i) => {
          expect(pick(publisher, ['channelPhoneNumber', 'publisherPhoneNumber'])).to.eql({
            channelPhoneNumber: channel.phoneNumber,
            publisherPhoneNumber: publisherPhoneNumbers[i],
          })
        })
      })
    })

    describe('when one of given pNums is an already-existing publisher', () => {
      let res
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        res = await channelRepository.addPublishers(db, channel.phoneNumber, publisherPhoneNumbers)
        publisherCount = await db.publication.count()

        await channelRepository.addPublishers(db, channel.phoneNumber, [
          publisherPhoneNumbers[1],
          genPhoneNumber(),
        ])
      })

      it('does not create a new publication for the already existing number', async () => {
        expect(await db.publication.count()).to.eql(publisherCount + 1)
      })

      it('returns all publishers (including already-existing ones)', () => {
        expect(res.length).to.eql(2)
      })
    })

    describe('when given an empty array of publisher numbers', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await channelRepository.addPublishers(
          db,
          channel.phoneNumber,
          publisherPhoneNumbers.slice(1),
        )
        publisherCount = await db.publication.count()
        await channelRepository.addPublishers(db, channel.phoneNumber, [])
      })

      it('creates no new publications', async () => {
        expect(await db.publication.count()).to.eql(publisherCount)
      })
    })

    describe('when given the pNum of a non-existent channel', () => {
      it('rejects a Promise with an error', async () => {
        expect(
          await channelRepository.addSubscriber(db, genPhoneNumber(), null).catch(e => e),
        ).to.contain('cannot subscribe human to non-existent channel')
      })
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

  describe('#findMemberships', () => {
    const channel2PhoneNumber = genPhoneNumber()
    const memberPhoneNumber = genPhoneNumber()

    beforeEach(
      async () =>
        // create 2 channels. member is publisher of first, subscriber to second
        await Promise.all([
          db.channel.create(
            {
              phoneNumber: channelPhoneNumber,
              name: '#foo',
              publications: [publicationFactory({ publisherPhoneNumber: memberPhoneNumber })],
            },
            {
              include: [{ model: db.publication }],
            },
          ),
          db.channel.create(
            {
              phoneNumber: channel2PhoneNumber,
              name: '#bar',
              subscriptions: [subscriptionFactory({ subscriberPhoneNumber: memberPhoneNumber })],
            },
            {
              include: [{ model: db.subscription }],
            },
          ),
        ]),
    )

    it('finds all channels for which a given phone number is either a publisher or subscriber', async () => {
      const { publications, subscriptions } = await channelRepository.findMemberships(
        db,
        memberPhoneNumber,
      )
      expect(publications.length).to.eql(1)
      expect(publications[0].channelPhoneNumber).to.eql(channelPhoneNumber)
      expect(publications[0].publisherPhoneNumber).to.eql(memberPhoneNumber)

      expect(subscriptions.length).to.eql(1)
      expect(subscriptions[0].channelPhoneNumber).to.eql(channel2PhoneNumber)
      expect(subscriptions[0].subscriberPhoneNumber).to.eql(memberPhoneNumber)
    })
  })

  describe('#removePublisher', () => {
    describe('when given the number of an existing publisher', () => {
      let result
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await channelRepository.addPublisher(db, channel.phoneNumber, publisherPhoneNumbers[0])
        subCount = await db.subscription.count()
        publisherCount = await db.publication.count()

        result = await channelRepository.removePublisher(
          db,
          channel.phoneNumber,
          publisherPhoneNumbers,
        )
      })

      it('deletes a publication record', async () => {
        expect(await db.publication.count()).to.eql(publisherCount - 1)
      })

      it('returns 1', () => {
        expect(result).to.eql(1)
      })
    })

    describe('when given the number of a non-existent publisher', () => {
      let result
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await channelRepository.addPublisher(db, channel.phoneNumber, publisherPhoneNumbers[0])
        publisherCount = await db.publication.count()

        result = await channelRepository.removePublisher(db, channel.phoneNumber, '+11111111111')
      })

      it('deletes an publication record', async () => {
        expect(await db.publication.count()).to.eql(publisherCount)
      })

      it('returns 0', () => {
        expect(result).to.eql(0)
      })
    })
  })

  describe('#addSubscriber', () => {
    describe('when given the pNum of an existing channel and a new human', () => {
      const subscriberPhone = subscriberPhoneNumbers[0]
      beforeEach(async () => {
        subCount = await db.subscription.count()
        channel = await db.channel.create(channelFactory())
        sub = await channelRepository.addSubscriber(db, channel.phoneNumber, subscriberPhone)
      })

      it('creates a new subscription', async () => {
        expect(await db.subscription.count()).to.eql(subCount + 1)
      })

      it('associates the subscription with the channel', async () => {
        const fetchedSubs = await channel.getSubscriptions()
        expect(fetchedSubs.map(s => s.get())).to.eql([sub.get()])
      })

      it('returns a subscription joining the channel to the human', () => {
        expect(pick(sub, ['channelPhoneNumber', 'subscriberPhoneNumber'])).to.eql({
          channelPhoneNumber: channel.phoneNumber,
          subscriberPhoneNumber: subscriberPhone,
        })
      })
    })

    describe('when given the pNum of a non-existent channel', () => {
      it('rejects a Promise with an error', async () => {
        expect(
          await channelRepository.addSubscriber(db, genPhoneNumber(), null).catch(e => e),
        ).to.contain('cannot subscribe human to non-existent channel')
      })
    })
  })

  describe('#removeSubscriber', () => {
    const [subscriberPhone, unsubscribedPhone] = subscriberPhoneNumbers

    beforeEach(async () => {
      channel = await db.channel.create(channelFactory())
      sub = await channelRepository.addSubscriber(db, channel.phoneNumber, subscriberPhone)
      subCount = await db.subscription.count()
    })

    describe('when given the phone number of an existing channel', () => {
      describe('when asked to remove a number that is subscribed to the channel', () => {
        let result
        beforeEach(async () => {
          result = await channelRepository.removeSubscriber(
            db,
            channel.phoneNumber,
            subscriberPhone,
          )
        })
        it('deletes the subscription', async () => {
          expect(await db.subscription.count()).to.eql(subCount - 1)
          expect(await channel.getSubscriptions()).to.eql([])
        })
        it('resolves with a deletion count of 1', () => {
          expect(result).to.eql(1)
        })
      })
      describe('when asked to remove a number that is not subscribed to the channel', () => {
        it('resolves with a deletion count of 0', async () => {
          expect(
            await channelRepository.removeSubscriber(db, channel.phoneNumber, unsubscribedPhone),
          ).to.eql(0)
        })
      })
    })

    describe('when given the phone number of a non-existent channel', () => {
      it('it rejects with an error', async () => {
        expect(
          await channelRepository.removeSubscriber(db, genPhoneNumber(), null).catch(e => e),
        ).to.contain('cannot unsubscribe human from non-existent channel')
      })
    })
  })

  describe('#isPublisher', () => {
    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory({ phoneNumber: channelPhoneNumber }),
          publications: [
            publicationFactory({ publisherPhoneNumber: publisherPhoneNumbers[0] }),
            publicationFactory({ publisherPhoneNumber: publisherPhoneNumbers[1] }),
          ],
        },
        {
          include: [{ model: db.publication }],
        },
      )
    })

    it("returns true when given a channel publisher's phone number", async () => {
      expect(
        await channelRepository.isPublisher(db, channelPhoneNumber, publisherPhoneNumbers[0]),
      ).to.eql(true)
    })

    it("it returns false when given a non-publisher's phone number", async () => {
      expect(
        await channelRepository.isPublisher(db, channelPhoneNumber, subscriberPhoneNumbers[0]),
      ).to.eql(false)
    })

    it('returns false when asked to check a non existent channel', async () => {
      expect(
        await channelRepository.isPublisher(db, genPhoneNumber(), subscriberPhoneNumbers[0]),
      ).to.eql(false)
    })
  })

  describe('#resolveSenderType', () => {
    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory({ phoneNumber: channelPhoneNumber }),
          publications: [publicationFactory({ publisherPhoneNumber: publisherPhoneNumbers[0] })],
          subscriptions: [
            subscriptionFactory({ subscriberPhoneNumber: subscriberPhoneNumbers[0] }),
          ],
        },
        {
          include: [{ model: db.publication }, { model: db.subscription }],
        },
      )
    })

    describe('when sender is publisher on channel', () => {
      it('returns PUBLISHER', async () => {
        expect(
          await channelRepository.resolveSenderType(
            db,
            channelPhoneNumber,
            publisherPhoneNumbers[0],
          ),
        ).to.eql(senderTypes.PUBLISHER)
      })
    })

    describe('when sender is subscribed to channel', () => {
      it('returns SUBSCRIBER', async () => {
        expect(
          await channelRepository.resolveSenderType(
            db,
            channelPhoneNumber,
            subscriberPhoneNumbers[0],
          ),
        ).to.eql(senderTypes.SUBSCRIBER)
      })
    })

    describe('when sender is neither publisher nor subscriber', () => {
      it('returns RANDOM', async () => {
        expect(
          await channelRepository.resolveSenderType(db, channelPhoneNumber, genPhoneNumber()),
        ).to.eql(senderTypes.RANDOM)
      })
    })
  })
})
