import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { times } from 'lodash'
import { channelFactory } from '../../../support/factories/channel'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../../../support/factories/membership'
import inviteRepository from '../../../../app/db/repositories/invite'
import { inviteFactory } from '../../../support/factories/invite'
import { wait } from '../../../../app/services/util'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
const {
  job: { inviteExpiryInMillis, inviteDeletionInterval },
} = require('../../../../app/config')

describe('invite repository', () => {
  const [
    channelPhoneNumber,
    adminPhoneNumber,
    subscriberPhoneNumber,
    pendingInviteePhoneNumber,
    randoPhoneNumber,
  ] = times(5, genPhoneNumber)
  let res, db, inviteCount, memberCount

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
  })
  beforeEach(async () => {
    await db.channel.create(
      channelFactory({
        phoneNumber: channelPhoneNumber,
        memberships: [
          adminMembershipFactory({ memberPhoneNumber: adminPhoneNumber }),
          subscriberMembershipFactory({ memberPhoneNumber: subscriberPhoneNumber }),
        ],
        invites: [
          inviteFactory({
            inviterPhoneNumber: subscriberPhoneNumber,
            inviteePhoneNumber: pendingInviteePhoneNumber,
          }),
        ],
      }),
      {
        include: [{ model: db.membership }, { model: db.invite }],
      },
    )
    inviteCount = await db.invite.count()
    memberCount = await db.membership.count()
  })
  afterEach(async () => {
    await Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.membership.destroy({ where: {}, force: true }),
      db.invite.destroy({ where: {}, force: true }),
    ])
  })
  after(async () => await app.stop())

  describe('#issue', () => {
    describe('when issuing an invite to a new member', () => {
      beforeEach(async () => {
        res = await inviteRepository.issue(channelPhoneNumber, adminPhoneNumber, randoPhoneNumber)
      })

      it('creates a new invite', async () => {
        expect(await db.invite.count()).to.be.above(inviteCount)
      })

      it('returns true', () => {
        expect(res).to.eql(true)
      })
    })

    describe('when issuing an invite to a pending invitee', () => {
      describe('from new invite issuer', () => {
        beforeEach(async () => {
          res = await inviteRepository.issue(
            channelPhoneNumber,
            adminPhoneNumber,
            pendingInviteePhoneNumber,
          )
        })

        it('creates a new invite', async () => {
          expect(await db.invite.count()).to.eql(inviteCount + 1)
        })

        it('returns true', () => {
          expect(res).to.eql(true)
        })
      })

      describe('from original invite issuer', () => {
        beforeEach(async () => {
          res = await inviteRepository.issue(
            channelPhoneNumber,
            subscriberPhoneNumber,
            pendingInviteePhoneNumber,
          )
        })

        it('does not create a new invite', async () => {
          expect(await db.invite.count()).to.eql(inviteCount)
        })

        it('returns false', () => {
          expect(res).to.eql(false)
        })
      })
    })
  })

  describe('#count', () => {
    it('counts the number of invites received by a number on a channel', async () => {
      expect(await inviteRepository.count(channelPhoneNumber, adminPhoneNumber)).to.eql(0)
      expect(await inviteRepository.count(channelPhoneNumber, pendingInviteePhoneNumber)).to.eql(1)
    })
  })

  describe('#accept', () => {
    beforeEach(async () => {
      await inviteRepository.accept(channelPhoneNumber, pendingInviteePhoneNumber)
    })

    it('subscribes invitee to channel', async () => {
      expect(await db.membership.count()).to.eql(memberCount + 1)
      expect(
        await db.membership.findOne({
          where: { memberPhoneNumber: pendingInviteePhoneNumber },
        }),
      ).not.to.eql(null)
    })

    it("deletes invitee's invite", async () => {
      expect(await db.invite.count()).to.eql(inviteCount - 1)
      expect(
        await db.invite.findOne({ where: { inviteePhoneNumber: pendingInviteePhoneNumber } }),
      ).to.eql(null)
    })
  })

  describe('#decline', () => {
    describe('when decliner has a pending invite', () => {
      beforeEach(async () => {
        await inviteRepository.decline(channelPhoneNumber, pendingInviteePhoneNumber)
      })

      it("deletes invitee's invite", async () => {
        expect(await db.invite.count()).to.eql(inviteCount - 1)
        expect(
          await db.invite.findOne({ where: { inviteePhoneNumber: pendingInviteePhoneNumber } }),
        ).to.eql(null)
      })
    })

    describe('when decliner has no pending invite', () => {
      let res
      beforeEach(async () => {
        res = await inviteRepository.decline(channelPhoneNumber, subscriberPhoneNumber)
      })

      it('does not throw', () => {
        expect(res).not.to.be.an('Error')
      })

      it('does not delete an invite', async () => {
        expect(await db.invite.count()).to.eql(inviteCount)
      })
    })
  })

  describe('#deleteExpired', () => {
    it('deletes any invite older than a given expiry time', async () => {
      await inviteRepository.deleteExpired()
      expect(await db.invite.count()).to.eql(inviteCount)

      await wait(inviteExpiryInMillis)
      await inviteRepository.deleteExpired()
      expect(await db.invite.count()).to.eql(inviteCount - 1)
    })
  })

  describe('#launchInviteDeletionJob', () => {
    beforeEach(async () => {
      await db.invite.destroy({ where: {}, force: true })
      await Promise.all([db.invite.create(inviteFactory()), db.invite.create(inviteFactory())])
      inviteCount = await db.invite.count()
      inviteRepository.launchInviteDeletionJob()
    })

    it('launches a job to delete expired invites at a specified interval', async () => {
      // the test deletion interval is 1/2 the expiry length
      // so in 4 intervals, we should observe 2 deletions
      expect(await db.invite.count()).to.eql(inviteCount)

      await wait(inviteDeletionInterval)
      expect(await db.invite.count()).to.eql(inviteCount)

      await wait(3 * inviteDeletionInterval)
      expect(await db.invite.count()).to.eql(inviteCount - 2)
    })
  })
})
