import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { pick } from 'lodash'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { initDb } from '../../../../app/db/index'
import { omit, keys } from 'lodash'
import channelRepository from '../../../../app/db/repositories/channel'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { publicationFactory } from '../../../support/factories/publication'
import { deepChannelAttrs } from '../../../support/factories/channel'

describe('channel repository', () => {
  chai.use(chaiAsPromised)

  const chPNum = genPhoneNumber()
  const subPNums = [genPhoneNumber(), genPhoneNumber()]
  const adminPNums = [genPhoneNumber(), genPhoneNumber()]
  let db, channel, sub, subCount, adminCount, admins, welcomeCount

  before(() => (db = initDb()))
  afterEach(async () => {
    await Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.publication.destroy({ where: {}, force: true }),
      db.subscription.destroy({ where: {}, force: true }),
      db.welcome.destroy({ where: {}, force: true }),
      db.messageCount.destroy({ where: {}, force: true }),
    ])
  })
  after(async () => await db.sequelize.close())

  describe('#activate', () => {
    let channel, channelCount, messageCountCount

    describe('when given phone number for a non-existent channel', () => {
      beforeEach(async () => {
        channelCount = await db.channel.count()
        messageCountCount = await db.messageCount.count()
        channel = await channelRepository.activate(db, chPNum, '#blackops', 'acabdeadbeef')
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

      it('returns the channel record', () => {
        expect(omit(channel.toJSON(), ['createdAt', 'updatedAt', 'messageCount'])).to.eql({
          phoneNumber: chPNum,
          name: '#blackops',
          containerId: 'acabdeadbeef',
        })
        expect(omit(channel.messageCount)).to.be.an('object')
      })
    })

    describe('when given phone number for a already-existing channel', () => {
      beforeEach(async () => {
        await channelRepository.activate(db, chPNum, '#foursquare', 'deadbeefacab')
        channelCount = await db.channel.count()
        messageCountCount = await db.messageCount.count()
        channel = await channelRepository.activate(db, chPNum, '#blackops', 'acabdeadbeef')
      })

      it('does not create a new channel', async () => {
        expect(await db.channel.count()).to.eql(channelCount)
      })

      it('does not create a new messageCount record', async () => {
        expect(await db.messageCount.count()).to.eql(messageCountCount)
      })

      it('updates the channel record and returns it', () => {
        expect(omit(channel.get(), ['createdAt', 'updatedAt'])).to.eql({
          phoneNumber: chPNum,
          name: '#blackops',
          containerId: 'acabdeadbeef',
        })
      })
    })
  })

  describe('#update', () => {
    let updatedChannel
    beforeEach(async () => {
      await db.channel.create({ phoneNumber: chPNum, name: 'foo' })
      updatedChannel = await channelRepository.update(db, chPNum, { name: 'bar' })
    })

    it("updates a channel's name", async () => {
      const newName = await db.channel
        .findOne({ where: { phoneNumber: chPNum } })
        .then(ch => ch.name)
      expect(newName).to.eql('bar')
    })

    it('returns a channel resources with updated values', () => {
      expect(updatedChannel.name).to.eql('bar')
    })
  })

  describe('#addAdmins', () => {
    describe('when given the pNum of an existing channel and a new human', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        subCount = await db.subscription.count()
        adminCount = await db.publication.count()
        admins = await channelRepository.addAdmins(db, channel.phoneNumber, adminPNums)
      })

      it('creates 2 new publications', async () => {
        expect(await db.publication.count()).to.eql(adminCount + 2)
      })

      it('associates the publications with the channel', async () => {
        const fetchedAdmins = await channel.getPublications()
        expect(fetchedAdmins.map(a => a.get())).to.have.deep.members(admins.map(a => a.get()))
      })

      it('creates 2 new subscriptions', async () => {
        expect(await db.subscription.count()).to.eql(subCount + 2)
      })

      it('associates the subscriptions with the channel', async () => {
        const fetchedSubs = await channel.getSubscriptions()
        expect(fetchedSubs.map(s => s.subscriberPhoneNumber)).to.have.deep.members(adminPNums)
      })

      it('returns an publication joining the channel to the human', () => {
        admins.forEach((admin, i) => {
          expect(pick(admin, ['channelPhoneNumber', 'publisherPhoneNumber'])).to.eql({
            channelPhoneNumber: channel.phoneNumber,
            publisherPhoneNumber: adminPNums[i],
          })
        })
      })
    })

    describe('when given the pNum of an already-existing admin', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await channelRepository.addAdmins(db, channel.phoneNumber, adminPNums.slice(1))
        subCount = await db.subscription.count()
        adminCount = await db.publication.count()
        await channelRepository.addAdmins(db, channel.phoneNumber, adminPNums)
      })

      it('only creates one new publication', async () => {
        expect(await db.publication.count()).to.eql(adminCount + 1)
      })

      it('only creates one new subscription', async () => {
        expect(await db.subscription.count()).to.eql(subCount + 1)
      })
    })

    describe('when given an empty array of admin numbers', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await channelRepository.addAdmins(db, channel.phoneNumber, adminPNums.slice(1))
        subCount = await db.subscription.count()
        adminCount = await db.publication.count()
        await channelRepository.addAdmins(db, channel.phoneNumber, [])
      })

      it('creates no new publications', async () => {
        expect(await db.publication.count()).to.eql(adminCount)
      })

      it('creates no new subscriptions', async () => {
        expect(await db.subscription.count()).to.eql(subCount)
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
    const adminNumbers = [genPhoneNumber(), genPhoneNumber()]
    const subscriberNumbers = [genPhoneNumber(), genPhoneNumber()]
    let result

    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory(),
          subscriptions: subscriberNumbers.map(num => ({ subscriberPhoneNumber: num })),
          publications: adminNumbers.map(num => ({ publisherPhoneNumber: num })),
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
        { channelPhoneNumber: channel.phoneNumber, publisherPhoneNumber: adminNumbers[0] },
        { channelPhoneNumber: channel.phoneNumber, publisherPhoneNumber: adminNumbers[1] },
      ])
    })

    it("retrieves the channel's subscriptions", () => {
      expect(
        result.subscriptions.map(a => pick(a.get(), ['channelPhoneNumber', 'subscriberPhoneNumber'])),
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
                { model: db.welcome },
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
          'containerId',
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

  describe('#removeAdmin', () => {
    describe('when given the number of an existing admin', () => {
      let result
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await channelRepository.addAdmin(db, channel.phoneNumber, adminPNums[0])
        subCount = await db.subscription.count()
        adminCount = await db.publication.count()

        result = await channelRepository.removeAdmin(db, channel.phoneNumber, adminPNums)
      })

      it('deletes a publication record', async () => {
        expect(await db.publication.count()).to.eql(adminCount - 1)
      })

      it('deletes an subscription record', async () => {
        expect(await db.subscription.count()).to.eql(subCount - 1)
      })

      it('returns the tuple [1,1]', () => {
        expect(result).to.eql([1, 1])
      })
    })

    describe('when given the number of a non-existent admin', () => {
      let result
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await channelRepository.addAdmin(db, channel.phoneNumber, adminPNums[0])
        subCount = await db.subscription.count()
        adminCount = await db.publication.count()

        result = await channelRepository.removeAdmin(db, channel.phoneNumber, '+11111111111')
      })

      it('deletes an publication record', async () => {
        expect(await db.publication.count()).to.eql(adminCount)
      })

      it('deletes an subscription record', async () => {
        expect(await db.subscription.count()).to.eql(subCount)
      })

      it('returns the tuple [0, 0]', () => {
        expect(result).to.eql([0, 0])
      })
    })
  })

  describe('#addSubscriber', () => {
    describe('when given the pNum of an existing channel and a new human', () => {
      const subscriberPhone = subPNums[0]
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
    const [subscriberPhone, unsubscribedPhone] = subPNums

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

  describe('#getSubscribers', () => {
    describe('when a channel has subscribers', () => {
      beforeEach(async () => {
        await db.channel.create(
          {
            ...channelFactory({ phoneNumber: chPNum }),
            subscriptions: [
              subscriptionFactory({ subscriberPhoneNumber: subPNums[0] }),
              subscriptionFactory({ subscriberPhoneNumber: subPNums[1] }),
            ],
          },
          {
            include: [{ model: db.subscription }],
          },
        )
      })

      it('returns the subscriber phone numbers', async () => {
        expect(await channelRepository.getSubscriberNumbers(db, chPNum)).to.have.members(subPNums)
      })
    })

    describe('when channel has no subscribers', () => {
      beforeEach(async () => {
        await db.channel.create(channelFactory({ phoneNumber: chPNum }))
      })

      it('returns an empty array', async () => {
        expect(await channelRepository.getSubscriberNumbers(db, chPNum)).to.eql([])
      })
    })

    describe('when channel does not exist', () => {
      it('rejects a promise with an error', async () => {
        expect(
          await channelRepository.getSubscriberNumbers(db, genPhoneNumber()).catch(e => e),
        ).to.contain('cannot retrieve subscriptions to non-existent channel')
      })
    })
  })

  describe('#isAdmin', () => {
    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory({ phoneNumber: chPNum }),
          publications: [
            publicationFactory({ publisherPhoneNumber: adminPNums[0] }),
            publicationFactory({ publisherPhoneNumber: adminPNums[1] }),
          ],
        },
        {
          include: [{ model: db.publication }],
        },
      )
    })

    it("returns true when given a channel admin's phone number", async () => {
      expect(await channelRepository.isAdmin(db, chPNum, adminPNums[0])).to.eql(true)
    })

    it("it returns false when given a non-admin's phone number", async () => {
      expect(await channelRepository.isAdmin(db, chPNum, subPNums[0])).to.eql(false)
    })

    it('returns false when asked to check a non existent channel', async () => {
      expect(await channelRepository.isAdmin(db, genPhoneNumber(), subPNums[0])).to.eql(false)
    })
  })

  describe('#createWelcome', () => {
    let result
    beforeEach(async () => {
      welcomeCount = await db.welcome.count()
      channel = await db.channel.create(channelFactory({ phoneNumber: chPNum }))
      result = await channelRepository.createWelcome(db, channel.phoneNumber, adminPNums[0])
    })

    it('creates a new welcome', async () => {
      expect(await db.welcome.count()).to.eql(welcomeCount + 1)
    })

    it('associates a welcomed number and a channel number', () => {
      expect(result.channelPhoneNumber).to.eql(channel.phoneNumber)
      expect(result.welcomedPhoneNumber).to.eql(adminPNums[0])
    })
  })

  describe('#getUnwelcomedAdminNumbers', () => {
    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory({ phoneNumber: chPNum }),
          publications: [
            { publisherPhoneNumber: adminPNums[0] },
            { publisherPhoneNumber: adminPNums[1] },
          ],
          welcomes: [{ welcomedPhoneNumber: adminPNums[0] }],
        },
        {
          include: [{ model: db.publication }, { model: db.welcome }],
        },
      )
    })

    it('returns an array of unwelcomed admin phone numbers', async () => {
      expect(await channelRepository.getUnwelcomedAdmins(db, channel.phoneNumber)).to.eql([
        adminPNums[1],
      ])
    })
  })
})
