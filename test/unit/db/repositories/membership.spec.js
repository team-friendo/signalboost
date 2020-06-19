import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { omit, pick } from 'lodash'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory } from '../../../support/factories/channel'
import membershipRepository from '../../../../app/db/repositories/membership'
import { languages } from '../../../../app/services/language'
import {
  adminMembershipFactory,
  membershipFactory,
  subscriberMembershipFactory,
} from '../../../support/factories/membership'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
const { memberTypes } = membershipRepository
const { defaultLanguage } = require('../../../../app/config')

describe('membership repository', () => {
  const channelPhoneNumber = genPhoneNumber()
  const subscriberPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  const adminPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  let db, channel, sub, membershipCount, subCount, adminCount, admins

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
  })
  afterEach(async () => {
    await Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.membership.destroy({ where: {}, force: true }),
      db.messageCount.destroy({ where: {}, force: true }),
    ])
  })
  after(async () => await app.stop())

  describe('#addAdmin', () => {
    describe('when given the phone number of an existing channel and a new admin', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        subCount = await db.membership.count({ where: { type: memberTypes.SUBSCRIBER } })
        adminCount = await db.membership.count({ where: { type: memberTypes.ADMIN } })
        admins = await membershipRepository.addAdmins(channel.phoneNumber, adminPhoneNumbers)
      })

      it('creates 2 new admin memberships', async () => {
        expect(await db.membership.count({ where: { type: memberTypes.ADMIN } })).to.eql(
          adminCount + 2,
        )
      })

      it('associates the admins with the channel', async () => {
        const fetchedAdmins = await channel.getMemberships()
        expect(fetchedAdmins.map(a => a.get())).to.have.deep.members(admins.map(a => a.get()))
      })

      it('creates no new subscriptions', async () => {
        expect(await db.membership.count({ where: { type: memberTypes.SUBSCRIBER } })).to.eql(
          subCount,
        )
      })

      it('returns a membership joining the channel to the human', () => {
        admins.forEach((membership, i) => {
          expect(
            pick(membership, ['type', 'channelPhoneNumber', 'memberPhoneNumber', 'language']),
          ).to.eql({
            type: memberTypes.ADMIN,
            channelPhoneNumber: channel.phoneNumber,
            memberPhoneNumber: adminPhoneNumbers[i],
            language: defaultLanguage,
          })
        })
      })
    })

    describe('when one of given phone numbers belongs to an already-existing admin', () => {
      let res
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await membershipRepository.addAdmins(channel.phoneNumber, adminPhoneNumbers)
        adminCount = await db.membership.count({ where: { type: memberTypes.ADMIN } })

        res = await membershipRepository.addAdmins(channel.phoneNumber, [
          adminPhoneNumbers[1],
          genPhoneNumber(),
        ])
      })

      it('does not create a new membership for the already existing number', async () => {
        expect(await db.membership.count({ where: { type: memberTypes.ADMIN } })).to.eql(
          adminCount + 1,
        )
      })

      it('returns all admins (including already-existing ones)', () => {
        expect(res.length).to.eql(2)
      })
    })

    describe('when given the phone number of an existing subscriber', () => {
      it('makes the subscriber an admin and does not create a new membership', () => {})
    })

    describe('#addAmin', () => {
      let res1, res2

      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        res1 = await membershipRepository.addAdmin(channel.phoneNumber, adminPhoneNumbers[0])
        membershipCount = await db.membership.count()

        res2 = await membershipRepository.addAdmin(channel.phoneNumber, adminPhoneNumbers[0])
      })

      describe('when given the number of an existing admin', () => {
        it('does not create a new admin', async () => {
          expect(await db.membership.count()).to.eql(membershipCount)
        })

        it("returns the existing admin's membership", () => {
          expect(res1.get()).to.eql(res2.get())
        })
      })

      describe('when given the number of an existing subscriber', () => {
        let res1, res2
        beforeEach(async () => {
          channel = await db.channel.create(channelFactory())
          res1 = await membershipRepository.addSubscriber(
            channel.phoneNumber,
            subscriberPhoneNumbers[0],
          )
          membershipCount = await db.membership.count()
          subCount = await db.membership.count({ where: { type: memberTypes.SUBSCRIBER } })
          adminCount = await db.membership.count({ where: { type: memberTypes.ADMIN } })

          res2 = await membershipRepository.addAdmin(channel.phoneNumber, subscriberPhoneNumbers[0])
        })

        it('makes the subscriber an admin and returns its membership', async () => {
          expect(res2.updatedAt).to.be.above(res1.updatedAt)
          expect(omit(res2.get(), ['updatedAt'])).to.eql(
            omit({ ...res1.get(), type: memberTypes.ADMIN }, ['updatedAt']),
          )
        })

        it('does not create a new membership', async () => {
          expect(await db.membership.count()).to.eql(membershipCount)
        })
      })
    })

    describe('when given an empty array of admin numbers', () => {
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await membershipRepository.addAdmins(channel.phoneNumber, adminPhoneNumbers.slice(1))
        adminCount = await db.membership.count({ where: { type: memberTypes.ADMIN } })
        await membershipRepository.addAdmins(channel.phoneNumber, [])
      })

      it('creates no new publications', async () => {
        expect(await db.membership.count({ where: { type: memberTypes.ADMIN } })).to.eql(adminCount)
      })
    })

    describe('when given the phone number of a non-existent channel', () => {
      it('rejects a Promise with an error', async () => {
        expect(
          await membershipRepository.addSubscriber(genPhoneNumber(), null).catch(e => e),
        ).to.contain('non-existent channel')
      })
    })
  })

  describe('#removeMember', () => {
    describe('when given the number of an existing admin', () => {
      let result
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await membershipRepository.addAdmin(channel.phoneNumber, adminPhoneNumbers[0])
        membershipCount = await db.membership.count({ where: { type: memberTypes.ADMIN } })

        result = await membershipRepository.removeMember(channel.phoneNumber, adminPhoneNumbers)
      })

      it('deletes a membership record', async () => {
        expect(await db.membership.count()).to.eql(membershipCount - 1)
      })

      it('returns 1', () => {
        expect(result).to.eql(1)
      })
    })

    describe('when given the number of a non-existent admin', () => {
      let result
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        await membershipRepository.addAdmin(channel.phoneNumber, adminPhoneNumbers[0])
        membershipCount = await db.membership.count()

        result = await membershipRepository.removeMember(channel.phoneNumber, '+11111111111')
      })

      it('does not create a membership record', async () => {
        expect(await db.membership.count()).to.eql(membershipCount)
      })

      it('returns 0', () => {
        expect(result).to.eql(0)
      })
    })
  })

  describe('#addSubscriber', () => {
    describe('when given the phone number of an existing channel and a new member', () => {
      const subscriberPhone = subscriberPhoneNumbers[0]
      beforeEach(async () => {
        membershipCount = await db.membership.count()
        channel = await db.channel.create(channelFactory())
        sub = await membershipRepository.addSubscriber(
          channel.phoneNumber,
          subscriberPhone,
          languages.ES,
        )
      })

      it('creates a new subscription', async () => {
        expect(await db.membership.count()).to.eql(membershipCount + 1)
      })

      it('associates the subscription with the channel', async () => {
        const fetchedSubs = await channel.getMemberships()
        expect(fetchedSubs.map(s => s.get())).to.eql([sub.get()])
      })

      it('returns a subscription joining the channel to the human', () => {
        expect(pick(sub, ['type', 'channelPhoneNumber', 'memberPhoneNumber', 'language'])).to.eql({
          type: memberTypes.SUBSCRIBER,
          channelPhoneNumber: channel.phoneNumber,
          memberPhoneNumber: subscriberPhone,
          language: languages.ES,
        })
      })
    })

    describe('when given the number of an existing subscriber', () => {
      let res1, res2
      beforeEach(async () => {
        channel = await db.channel.create(channelFactory())
        res1 = await membershipRepository.addSubscriber(
          
          channel.phoneNumber,
          subscriberPhoneNumbers[0],
        )
        membershipCount = await db.membership.count()

        res2 = await membershipRepository.addSubscriber(
          
          channel.phoneNumber,
          subscriberPhoneNumbers[0],
        )
      })

      it("does not modify the subscriber's membership", async () => {
        expect(res2.dataValues).to.eql(res1.dataValues)
      })

      it('does not create a new membership', async () => {
        expect(await db.membership.count()).to.eql(membershipCount)
      })
    })

    describe('when given the pNum of a non-existent channel', () => {
      it('rejects a Promise with an error', async () => {
        expect(
          await membershipRepository.addSubscriber(genPhoneNumber(), null).catch(e => e),
        ).to.contain('non-existent channel')
      })
    })
  })

  describe('#removeMember', () => {
    const [subscriberPhone, unsubscribedPhone] = subscriberPhoneNumbers

    beforeEach(async () => {
      channel = await db.channel.create(channelFactory())
      sub = await membershipRepository.addSubscriber(channel.phoneNumber, subscriberPhone)
      membershipCount = await db.membership.count()
    })

    describe('when given the phone number of an existing channel', () => {
      describe('when asked to remove a number that is subscribed to the channel', () => {
        let result
        beforeEach(async () => {
          result = await membershipRepository.removeMember(channel.phoneNumber, subscriberPhone)
        })
        it('deletes a membership', async () => {
          expect(await db.membership.count()).to.eql(membershipCount - 1)
          expect(await channel.getMemberships()).to.eql([])
        })
        it('resolves with a deletion count of 1', () => {
          expect(result).to.eql(1)
        })
      })
      describe('when asked to remove a number that is not subscribed to the channel', () => {
        it('resolves with a deletion count of 0', async () => {
          expect(
            await membershipRepository.removeMember(channel.phoneNumber, unsubscribedPhone),
          ).to.eql(0)
        })
      })
    })

    describe('when given the phone number of a non-existent channel', () => {
      it('it rejects with an error', async () => {
        expect(
          await membershipRepository.removeMember(genPhoneNumber(), null).catch(e => e),
        ).to.contain('non-existent channel')
      })
    })
  })

  describe('#isAdmin', () => {
    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory({ phoneNumber: channelPhoneNumber }),
          memberships: [
            membershipFactory({ type: memberTypes.ADMIN, memberPhoneNumber: adminPhoneNumbers[0] }),
            membershipFactory({ type: memberTypes.ADMIN, memberPhoneNumber: adminPhoneNumbers[1] }),
          ],
        },
        {
          include: [{ model: db.membership }],
        },
      )
    })

    it("returns true when given a channel admin's phone number", async () => {
      expect(await membershipRepository.isAdmin(channelPhoneNumber, adminPhoneNumbers[0])).to.eql(
        true,
      )
    })

    it("it returns false when given a non-admin's phone number", async () => {
      expect(
        await membershipRepository.isAdmin(channelPhoneNumber, subscriberPhoneNumbers[0]),
      ).to.eql(false)
    })

    it('returns false when asked to check a non existent channel', async () => {
      expect(
        await membershipRepository.isAdmin(genPhoneNumber(), subscriberPhoneNumbers[0]),
      ).to.eql(false)
    })
  })

  describe('#resolveMemberType', () => {
    beforeEach(async () => {
      channel = await db.channel.create(
        {
          ...channelFactory({ phoneNumber: channelPhoneNumber }),
          memberships: [
            membershipFactory({ type: memberTypes.ADMIN, memberPhoneNumber: adminPhoneNumbers[0] }),
            membershipFactory({
              type: memberTypes.SUBSCRIBER,
              memberPhoneNumber: subscriberPhoneNumbers[0],
            }),
          ],
        },
        {
          include: [{ model: db.membership }],
        },
      )
    })

    describe('when sender is admin on channel', () => {
      it('returns ADMIN', async () => {
        expect(
          await membershipRepository.resolveMemberType(channelPhoneNumber, adminPhoneNumbers[0]),
        ).to.eql(memberTypes.ADMIN)
      })
    })

    describe('when sender is subscribed to channel', () => {
      it('returns SUBSCRIBER', async () => {
        expect(
          await membershipRepository.resolveMemberType(
            channelPhoneNumber,
            subscriberPhoneNumbers[0],
          ),
        ).to.eql(memberTypes.SUBSCRIBER)
      })
    })

    describe('when sender is neither admin nor subscriber', () => {
      it('returns RANDOM', async () => {
        expect(
          await membershipRepository.resolveMemberType(channelPhoneNumber, genPhoneNumber()),
        ).to.eql(memberTypes.NONE)
      })
    })
  })

  describe('#updateLanguage', () => {
    const memberPhoneNumber = genPhoneNumber()
    let result

    describe('when member is a admin', () => {
      beforeEach(async () => {
        await db.membership.create(
          adminMembershipFactory({ memberPhoneNumber, language: languages.EN }),
        )
        result = await membershipRepository.updateLanguage(memberPhoneNumber, languages.ES)
      })

      it('updates the membership language', async () => {
        expect(result).to.eql([1])
        expect(
          await db.membership.findOne({ where: { memberPhoneNumber } }).then(p => p.language),
        ).to.eql(languages.ES)
      })
    })

    describe('when member is a subscriber', () => {
      beforeEach(async () => {
        await db.membership.create(
          subscriberMembershipFactory({
            memberPhoneNumber: memberPhoneNumber,
            language: languages.EN,
          }),
        )
        result = await membershipRepository.updateLanguage(memberPhoneNumber, languages.ES)
      })

      it('updates the subscription language', async () => {
        expect(result).to.eql([1])
        expect(
          await db.membership.findOne({ where: { memberPhoneNumber } }).then(p => p.language),
        ).to.eql(languages.ES)
      })
    })

    describe('when sender is neither admin nor subscriber', () => {
      beforeEach(async () => {
        result = await membershipRepository.updateLanguage(genPhoneNumber(), languages.ES)
      })
      it('does nothing', () => {
        expect(result).to.eql([0])
      })
    })
  })
})
