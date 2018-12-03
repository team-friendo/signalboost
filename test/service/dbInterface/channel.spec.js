import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { pick } from 'lodash'
import { channelFactory } from '../../support/factories/channel'
import { phoneNumberFactory } from '../../support/factories/phoneNumber'
import { initDb } from '../../../app/db'
import { addSubscriber } from '../../../app/service/dbInterface/channel'

describe('channel db interface service', () => {
  chai.use(chaiAsPromised)
  let db

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
      let channel, sub, subCount

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
})
