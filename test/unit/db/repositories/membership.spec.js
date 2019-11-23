import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { pick } from 'lodash'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory } from '../../../support/factories/channel'
import membershipRepository from '../../../../app/db/repositories/membership'
import { initDb } from '../../../../app/db'
import { languages } from '../../../../app/constants'
import { publicationFactory } from '../../../support/factories/publication'
import { subscriptionFactory } from '../../../support/factories/subscription'
const { memberTypes } = membershipRepository

describe('membership repository', () => {
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

  describe('#addPublishers', () => {
    describe('when given the pNum of an existing channel and a new human', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        subCount = await db.subscription.count()
        publisherCount = await db.publication.count()
        publishers = await membershipRepository.addPublishers(
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
        res = await membershipRepository.addPublishers(db, channel.phoneNumber, publisherPhoneNumbers)
        publisherCount = await db.publication.count()

        await membershipRepository.addPublishers(db, channel.phoneNumber, [
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
        await membershipRepository.addPublishers(
          db,
          channel.phoneNumber,
          publisherPhoneNumbers.slice(1),
        )
        publisherCount = await db.publication.count()
        await membershipRepository.addPublishers(db, channel.phoneNumber, [])
      })

      it('creates no new publications', async () => {
        expect(await db.publication.count()).to.eql(publisherCount)
      })
    })

    describe('when given the pNum of a non-existent channel', () => {
      it('rejects a Promise with an error', async () => {
        expect(
          await membershipRepository.addSubscriber(db, genPhoneNumber(), null).catch(e => e),
        ).to.contain('cannot subscribe human to non-existent channel')
      })
    })
  })

  describe('#removePublisher', () => {
    describe('when given the number of an existing publisher', () => {
      let result
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await membershipRepository.addPublisher(db, channel.phoneNumber, publisherPhoneNumbers[0])
        subCount = await db.subscription.count()
        publisherCount = await db.publication.count()

        result = await membershipRepository.removePublisher(
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
        await membershipRepository.addPublisher(db, channel.phoneNumber, publisherPhoneNumbers[0])
        publisherCount = await db.publication.count()

        result = await membershipRepository.removePublisher(db, channel.phoneNumber, '+11111111111')
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
        sub = await membershipRepository.addSubscriber(
          db,
          channel.phoneNumber,
          subscriberPhone,
          languages.ES,
        )
      })

      it('creates a new subscription', async () => {
        expect(await db.subscription.count()).to.eql(subCount + 1)
      })

      it('associates the subscription with the channel', async () => {
        const fetchedSubs = await channel.getSubscriptions()
        expect(fetchedSubs.map(s => s.get())).to.eql([sub.get()])
      })

      it('returns a subscription joining the channel to the human', () => {
        expect(pick(sub, ['channelPhoneNumber', 'subscriberPhoneNumber', 'language'])).to.eql({
          channelPhoneNumber: channel.phoneNumber,
          subscriberPhoneNumber: subscriberPhone,
          language: languages.ES,
        })
      })
    })

    describe('when given the pNum of a non-existent channel', () => {
      it('rejects a Promise with an error', async () => {
        expect(
          await membershipRepository.addSubscriber(db, genPhoneNumber(), null).catch(e => e),
        ).to.contain('cannot subscribe human to non-existent channel')
      })
    })
  })

  describe('#removeSubscriber', () => {
    const [subscriberPhone, unsubscribedPhone] = subscriberPhoneNumbers

    beforeEach(async () => {
      channel = await db.channel.create(channelFactory())
      sub = await membershipRepository.addSubscriber(db, channel.phoneNumber, subscriberPhone)
      subCount = await db.subscription.count()
    })

    describe('when given the phone number of an existing channel', () => {
      describe('when asked to remove a number that is subscribed to the channel', () => {
        let result
        beforeEach(async () => {
          result = await membershipRepository.removeSubscriber(db, channel.phoneNumber, subscriberPhone)
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
            await membershipRepository.removeSubscriber(db, channel.phoneNumber, unsubscribedPhone),
          ).to.eql(0)
        })
      })
    })

    describe('when given the phone number of a non-existent channel', () => {
      it('it rejects with an error', async () => {
        expect(
          await membershipRepository.removeSubscriber(db, genPhoneNumber(), null).catch(e => e),
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
        await membershipRepository.isPublisher(db, channelPhoneNumber, publisherPhoneNumbers[0]),
      ).to.eql(true)
    })

    it("it returns false when given a non-publisher's phone number", async () => {
      expect(
        await membershipRepository.isPublisher(db, channelPhoneNumber, subscriberPhoneNumbers[0]),
      ).to.eql(false)
    })

    it('returns false when asked to check a non existent channel', async () => {
      expect(
        await membershipRepository.isPublisher(db, genPhoneNumber(), subscriberPhoneNumbers[0]),
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
          await membershipRepository.resolveSenderType(
            db,
            channelPhoneNumber,
            publisherPhoneNumbers[0],
          ),
        ).to.eql(memberTypes.PUBLISHER)
      })
    })

    describe('when sender is subscribed to channel', () => {
      it('returns SUBSCRIBER', async () => {
        expect(
          await membershipRepository.resolveSenderType(
            db,
            channelPhoneNumber,
            subscriberPhoneNumbers[0],
          ),
        ).to.eql(memberTypes.SUBSCRIBER)
      })
    })

    describe('when sender is neither publisher nor subscriber', () => {
      it('returns RANDOM', async () => {
        expect(
          await membershipRepository.resolveSenderType(db, channelPhoneNumber, genPhoneNumber()),
        ).to.eql(memberTypes.NONE)
      })
    })
  })

  describe('#updateMemberLanguage', () => {
    const memberPhoneNumber = genPhoneNumber()
    let result

    describe('when member is a publisher', () => {
      beforeEach(async () => {
        await db.publication.create(
          publicationFactory({ publisherPhoneNumber: memberPhoneNumber, language: languages.EN }),
        )
        result = await membershipRepository.updateMemberLanguage(
          db,
          memberPhoneNumber,
          memberTypes.PUBLISHER,
          languages.ES,
        )
      })

      it('updates the publication language', async () => {
        expect(result).to.eql([1])
        expect(
          await db.publication
            .findOne({ where: { publisherPhoneNumber: memberPhoneNumber } })
            .then(p => p.language),
        ).to.eql(languages.ES)
      })
    })

    describe('when member is a subscriber', () => {
      beforeEach(async () => {
        await db.subscription.create(
          subscriptionFactory({
            subscriberPhoneNumber: memberPhoneNumber,
            language: languages.EN,
          }),
        )
        result = await membershipRepository.updateMemberLanguage(
          db,
          memberPhoneNumber,
          memberTypes.SUBSCRIBER,
          languages.ES,
        )
      })

      it('updates the subscription language', async () => {
        expect(result).to.eql([1])
        expect(
          await db.subscription
            .findOne({ where: { subscriberPhoneNumber: memberPhoneNumber } })
            .then(p => p.language),
        ).to.eql(languages.ES)
      })
    })

    describe('when sender is neither publisher nor subscriber', () => {
      beforeEach(async () => {
        result = await membershipRepository.updateMemberLanguage(
          db,
          memberPhoneNumber,
          memberTypes.NONE,
          languages.ES,
        )
      })
      it('does nothing', () => {
        expect(result).to.eql([0])
      })
    })
  })
})
