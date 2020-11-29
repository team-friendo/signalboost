import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { times } from 'lodash'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory } from '../../../support/factories/channel'
import banRepository from '../../../../app/db/repositories/ban'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'

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
      await db.ban.create({ channelPhoneNumber, memberPhoneNumber })
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
      banCount = await db.ban.count()
      await banRepository.banMember(channelPhoneNumber, memberPhoneNumber)
    })
    describe('for valid phone numbers', async () => {
      it('creates a new record', async () => {
        expect(await db.ban.count()).to.eql(banCount + 1)
      })
    })
  })
})
