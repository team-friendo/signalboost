import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { times } from 'lodash'
import { initDb } from '../../../../app/db'
import { channelFactory } from '../../../support/factories/channel'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../../../support/factories/membership'
import * as inviteRepository from '../../../../app/db/repositories/invite'
import { inviteFactory } from '../../../support/factories/invite'

describe('invite repository', () => {
  const [
    channelPhoneNumber,
    adminPhoneNumber,
    subscriberPhoneNumber,
    pendingInviteePhoneNumber,
    randoPhoneNumber,
  ] = times(5, genPhoneNumber)
  let res, db, inviteCount

  before(() => (db = initDb()))
  afterEach(async () => {
    await Promise.all([
      db.channel.destroy({ where: {}, force: true }),
      db.membership.destroy({ where: {}, force: true }),
      db.invite.destroy({ where: {}, force: true }),
    ])
  })
  after(async () => await db.sequelize.close())

  describe('#issue', () => {
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
    })

    describe('when issuing an invite to a new member', () => {
      beforeEach(async () => {
        res = await inviteRepository.issue(
          db,
          channelPhoneNumber,
          adminPhoneNumber,
          randoPhoneNumber,
        )
      })

      it('creates a new invite', async () => {
        expect(await db.invite.count()).to.be.above(inviteCount)
      })

      it('returns true', () => {
        expect(res).to.eql(true)
      })
    })

    describe('when issuing an invite to an existing member', () => {
      beforeEach(async () => {
        res = await inviteRepository.issue(
          db,
          channelPhoneNumber,
          adminPhoneNumber,
          subscriberPhoneNumber,
        )
      })

      it('does not create a new invite', async () => {
        expect(await db.invite.count()).to.eql(inviteCount)
      })

      it('returns false', () => {
        expect(res).to.eql(false)
      })
    })

    describe('when issuing an invite to a pending invitee', () => {
      describe('from new invite issuer', () => {
        beforeEach(async () => {
          res = await inviteRepository.issue(
            db,
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
            db,
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
})
