import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { pick } from 'lodash'
import { channelFactory } from '../../support/factories/channel'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { initDb } from '../../../app/db'
import {
  addSubscriber,
  getSubscriberNumbers,
  isAdmin,
  removeSubscriber,
} from '../../../app/service/repository/channel'
import { subscriptionFactory } from '../../support/factories/subscription'
import { administrationFactory } from '../../support/factories/administration'

describe('channel db interface service', () => {
  chai.use(chaiAsPromised)

  const chPNum = genPhoneNumber()
  const subPNums = [genPhoneNumber(), genPhoneNumber()]
  const adminPNums = [genPhoneNumber(), genPhoneNumber()]
  let db, channel, sub, subCount

  before(() => (db = initDb()))
  afterEach(() => {
    Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.administration.destroy({ where: {}, force: true }),
      db.subscription.destroy({ where: {}, force: true }),
    ])
  })
  after(() => db.sequelize.close())

  describe('#addSubscriber', () => {
    describe('when given the pNum of an existing channel and a new human', () => {
      const subscriberPhone = subPNums[0]
      beforeEach(async () => {
        subCount = await db.subscription.count()
        channel = await db.channel.create(channelFactory())
        sub = await addSubscriber(db, channel.phoneNumber, subscriberPhone)
      })

      it('creates a new subscription', async () => {
        expect(await db.subscription.count()).to.eql(subCount + 1)
      })

      it('associates the subscription with the channel', async () => {
        const fetchedSubs = await channel.getSubscriptions()
        expect(fetchedSubs.map(s => s.get())).to.eql([sub.get()])
      })

      it('returns a subscription joining the channel to the human', () => {
        expect(pick(sub, ['channelPhoneNumber', 'humanPhoneNumber'])).to.eql({
          channelPhoneNumber: channel.phoneNumber,
          humanPhoneNumber: subscriberPhone,
        })
      })
    })

    describe('when given the pNum of a non-existent channel', () => {
      it('rejects a Promise with an error', async () => {
        expect(await addSubscriber(db, genPhoneNumber(), null).catch(e => e)).to.contain(
          'cannot subscribe human to non-existent channel',
        )
      })
    })
  })

  describe('#removeSubscriber', () => {
    const [subscriberPhone, unsubscribedPhone] = subPNums

    beforeEach(async () => {
      channel = await db.channel.create(channelFactory())
      sub = await addSubscriber(db, channel.phoneNumber, subscriberPhone)
      subCount = await db.subscription.count()
    })

    describe('when given the phone number of an existing channel', () => {
      describe('when asked to remove a number that is subscribed to the channel', () => {
        let result
        beforeEach(async () => {
          result = await removeSubscriber(db, channel.phoneNumber, subscriberPhone)
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
          expect(await removeSubscriber(db, channel.phoneNumber, unsubscribedPhone)).to.eql(0)
        })
      })
    })

    describe('when given the phone number of a non-existent channel', () => {
      it('it rejects with an error', async () => {
        expect(await removeSubscriber(db, genPhoneNumber(), null).catch(e => e)).to.contain(
          'cannot unsubscribe human from non-existent channel',
        )
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
              subscriptionFactory({ humanPhoneNumber: subPNums[0] }),
              subscriptionFactory({ humanPhoneNumber: subPNums[1] }),
            ],
          },
          {
            include: [{ model: db.subscription }],
          },
        )
      })

      it('returns the subscriber phone numbers', async () => {
        expect(await getSubscriberNumbers(db, chPNum)).to.have.members(subPNums)
      })
    })

    describe('when channel has no subscribers', () => {
      beforeEach(async () => {
        await db.channel.create(channelFactory({ phoneNumber: chPNum }))
      })

      it('returns an empty array', async () => {
        expect(await getSubscriberNumbers(db, chPNum)).to.eql([])
      })
    })

    describe('when channel does not exist', () => {
      it('rejects a promise with an error', async () => {
        expect(await getSubscriberNumbers(db, genPhoneNumber()).catch(e => e)).to.contain(
          'cannot retrieve subscriptions to non-existent channel',
        )
      })
    })
  })

  describe('#isAdmin', () => {
    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory({ phoneNumber: chPNum }),
          administrations: [
            administrationFactory({ humanPhoneNumber: adminPNums[0] }),
            administrationFactory({ humanPhoneNumber: adminPNums[1] }),
          ],
        },
        {
          include: [{ model: db.administration }],
        },
      )
    })

    it("returns true when given a channel admin's phone number", async () => {
      expect(await isAdmin(db, chPNum, adminPNums[0])).to.eql(true)
    })

    it("it returns false when given a non-admin's phone number", async () => {
      expect(await isAdmin(db, chPNum, subPNums[0])).to.eql(false)
    })

    it('returns false when asked to check a non existent channel', async () => {
      expect(await isAdmin(db, genPhoneNumber(), subPNums[0])).to.eql(false)
    })
  })
})
