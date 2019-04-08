import chai, { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import chaiAsPromised from 'chai-as-promised'
import { pick } from 'lodash'
import { channelFactory } from '../../support/factories/channel'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { initDb } from '../../../app/db/index'
import { omit } from 'lodash'
import {
  addAdmin,
  addAdmins,
  removeAdmin,
  addSubscriber,
  update,
  updateOrCreate,
  getSubscriberNumbers,
  isAdmin,
  removeSubscriber,
} from '../../../app/db/repositories/channel'
import { subscriptionFactory } from '../../support/factories/subscription'
import { administrationFactory } from '../../support/factories/administration'

describe('channel repository', () => {
  chai.use(chaiAsPromised)

  const chPNum = genPhoneNumber()
  const subPNums = [genPhoneNumber(), genPhoneNumber()]
  const adminPNums = [genPhoneNumber(), genPhoneNumber()]
  let db, channel, sub, subCount, adminCount, admins

  before(() => (db = initDb()))
  afterEach(async () => {
    await Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.administration.destroy({ where: {}, force: true }),
      db.subscription.destroy({ where: {}, force: true }),
    ])
  })
  after(async () => await db.sequelize.close())

  describe('#updateOrCreate', () => {
    let count, channel

    describe('when given phone number for a non-existent channel', () => {
      beforeEach(async () => {
        count = await db.channel.count()
        channel = await updateOrCreate(db, chPNum, '#blackops', 'acabdeadbeef')
      })

      it('creates a new channel', async () => {
        expect(await db.channel.count()).to.eql(count + 1)
      })

      it('returns the channel record', () => {
        expect(omit(channel.get(), ['createdAt', 'updatedAt'])).to.eql({
          phoneNumber: chPNum,
          name: '#blackops',
          containerId: 'acabdeadbeef',
        })
      })
    })

    describe('when given phone number for a already-existing channel', () => {
      beforeEach(async () => {
        await updateOrCreate(db, chPNum, '#foursquare', 'deadbeefacab')
        count = await db.channel.count()
        channel = await updateOrCreate(db, chPNum, '#blackops', 'acabdeadbeef')
      })

      it('does not create a new channel', async () => {
        expect(await db.channel.count()).to.eql(count)
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
      updatedChannel = await update(db, chPNum, { name: 'bar' })
    })

    it("updates a channel's name", async () => {
      const newName = await db.channel.findOne({ phoneNumber: chPNum}).then(ch => ch.name)
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
        adminCount = await db.administration.count()
        admins = await addAdmins(db, channel.phoneNumber, adminPNums)
      })

      it('creates 2 new administrations', async () => {
        expect(await db.administration.count()).to.eql(adminCount + 2)
      })

      it('associates the administrations with the channel', async () => {
        const fetchedAdmins = await channel.getAdministrations()
        expect(fetchedAdmins.map(a => a.get())).to.have.deep.members(admins.map(a => a.get()))
      })

      it('creates 2 new subscriptions', async () => {
        expect(await db.subscription.count()).to.eql(subCount + 2)
      })

      it('associates the subscriptions with the channel', async () => {
        const fetchedSubs = await channel.getSubscriptions()
        expect(fetchedSubs.map(s => s.humanPhoneNumber)).to.have.deep.members(adminPNums)
      })

      it('returns an administration joining the channel to the human', () => {
        admins.forEach((admin, i) => {
          expect(pick(admin, ['channelPhoneNumber', 'humanPhoneNumber'])).to.eql({
            channelPhoneNumber: channel.phoneNumber,
            humanPhoneNumber: adminPNums[i],
          })
        })
      })
    })

    describe('when given the pNum of an already-existing admin', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await addAdmins(db, channel.phoneNumber, adminPNums.slice(1))
        subCount = await db.subscription.count()
        adminCount = await db.administration.count()
        await addAdmins(db, channel.phoneNumber, adminPNums)
      })

      it('only creates one new administration', async () => {
        expect(await db.administration.count()).to.eql(adminCount + 1)
      })

      it('only creates one new subscription', async () => {
        expect(await db.subscription.count()).to.eql(subCount + 1)
      })
    })

    describe('when given an empty array of admin numbers', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await addAdmins(db, channel.phoneNumber, adminPNums.slice(1))
        subCount = await db.subscription.count()
        adminCount = await db.administration.count()
        await addAdmins(db, channel.phoneNumber, [])
      })

      it('creates no new administrations', async () => {
        expect(await db.administration.count()).to.eql(adminCount)
      })

      it('creates no new subscriptions', async () => {
        expect(await db.subscription.count()).to.eql(subCount)
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

  describe('#removeAdmin', () => {
    describe('when given the number of an existing admin', () => {
      let result
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await addAdmin(db, channel.phoneNumber, adminPNums[0])
        subCount = await db.subscription.count()
        adminCount = await db.administration.count()

        result = await removeAdmin(db, channel.phoneNumber, adminPNums)
      })

      it('deletes an administration record', async () => {
        expect(await db.administration.count()).to.eql(adminCount - 1)
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
        await addAdmin(db, channel.phoneNumber, adminPNums[0])
        subCount = await db.subscription.count()
        adminCount = await db.administration.count()

        result = await removeAdmin(db, channel.phoneNumber, '+11111111111')
      })

      it('deletes an administration record', async () => {
        expect(await db.administration.count()).to.eql(adminCount)
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
