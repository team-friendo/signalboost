import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { pick } from 'lodash'
import { channelFactory } from '../../support/factories/channel'
import { phoneNumberFactory } from '../../support/factories/phoneNumber'
import { initDb } from '../../../app/db'
import {
  addSubscriber,
  getSubscriberNumbers,
  getSubscribers,
} from '../../../app/service/dbInterface/channel'
import { subscriptionFactory } from '../../support/factories/subscription'

describe('channel db interface service', () => {
  chai.use(chaiAsPromised)
  let db, channel, sub, subs, subCount

  before(() => (db = initDb()))
  afterEach(() => {
    Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.subscription.destroy({ where: {}, force: true }),
    ])
  })
  after(() => db.sequelize.close())

  describe('#addSubscriber', () => {
    describe('when given the pNum of an existing channel and a new human', () => {
      const subscriberPhone = phoneNumberFactory()
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
        expect(
          await addSubscriber(db, phoneNumberFactory(), phoneNumberFactory()).catch(e => e),
        ).to.contain('cannot subscribe human to non-existent channel')
      })
    })
  })

  describe('#getSubscribers', () => {
    const chPNum = phoneNumberFactory()
    const subPNums = [phoneNumberFactory(), phoneNumberFactory()]

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
        expect(await getSubscriberNumbers(db, chPNum)).to.eql(subPNums)
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
        expect(await getSubscriberNumbers(db, phoneNumberFactory()).catch(e => e)).to.contain(
          'cannot retrieve subscriptions to non-existent channel',
        )
      })
    })
  })
})
