import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { times } from 'lodash'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory } from '../../../support/factories/channel'
import banRepository from '../../../../app/db/repositories/ban'
import app from '../../../../app'
import util from '../../../../app/util'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
import { subscriberMembershipFactory } from '../../../support/factories/membership'

describe('ban repository', async () => {
  const [memberPhoneNumber, memberPhoneNumber2] = times(2, genPhoneNumber)
  let db, channelPhoneNumber, banCount

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
    channelPhoneNumber = (await db.channel.create(channelFactory())).phoneNumber
  })

  afterEach(async () => {
    await db.ban.destroy({ where: {}, force: true })
  })

  after(async () => {
    await db.channel.destroy({ where: {}, force: true })
    await app.stop()
  })

  describe('#isBanned', () => {
    beforeEach(async () => {
      await db.ban.create({
        channelPhoneNumber,
        memberPhoneNumber: util.sha256Hash(memberPhoneNumber),
      })
    })
    describe('for a member who has been banned', () => {
      it('returns true', async () => {
        expect(await banRepository.isBanned(channelPhoneNumber, memberPhoneNumber)).to.eql(true)
      })
    })
    describe('for a member who has not been banned', () => {
      it('returns false', async () => {
        expect(await banRepository.isBanned(channelPhoneNumber, memberPhoneNumber2)).to.eql(false)
      })
    })
  })

  describe('#banMember', () => {
    beforeEach(async () => {
      await app.db.membership.create(
        subscriberMembershipFactory({ channelPhoneNumber, memberPhoneNumber }),
      )
      banCount = await db.ban.count()
      await banRepository.banMember(channelPhoneNumber, memberPhoneNumber)
    })

    it('creates a new ban record for a member phone number on a channel', async () => {
      expect(await db.ban.count()).to.eql(banCount + 1)
    })

    it('destroys a membership of the member phone number on the channel', async () => {
      expect(await db.membership.findAll({ where: { channelPhoneNumber, memberPhoneNumber } })).to
        .be.empty
    })
  })

  describe('#findBanned', () => {
    const allNumbers = times(4, genPhoneNumber)
    const bannedNumbers = allNumbers.slice(0, 2)

    beforeEach(async () => {
      await Promise.all(
        bannedNumbers.map(pNum =>
          db.ban.create({
            channelPhoneNumber,
            memberPhoneNumber: util.sha256Hash(pNum),
          }),
        ),
      )
    })

    it('returns the subset of a list of member phone numbers that are banned', async () => {
      expect(await banRepository.findBanned(channelPhoneNumber, allNumbers)).to.eql(bannedNumbers)
    })
  })
})
