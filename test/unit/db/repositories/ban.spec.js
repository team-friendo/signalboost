import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { times } from 'lodash'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory } from '../../../support/factories/channel'
import { banFactory } from '../../../support/factories/ban'
import banRepository from '../../../../app/db/repositories/ban'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'

describe.only('ban repository', async () => {
  const memberPhoneNumber = genPhoneNumber()
  // let channelPhoneNumber = (await db.channel.create(channelFactory())).phoneNumber
  let db, ban, channelPhoneNumber

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
    channelPhoneNumber = (await db.channel.create(channelFactory())).phoneNumber
    console.log(db.ban)
  })
  // beforeEach(async () => {
  //   await db.channel.create(
  //     channelFactory({
  //       phoneNumber: channelPhoneNumber,
  //       bans: [
  //         banFactory({
  //           channelPhoneNumber,
  //           memberPhoneNumber,
  //         }),
  //       ],
  //     }),
  //     {
  //       include: [{ model: db.ban }],
  //     },
  //   )
  //   banCount = await db.ban.count()
  // })

  afterEach(async () => {
    await db.ban.destroy({ where: {}, force: true })
  })

  after(async () => {
    await db.channel.destroy({ where: {}, force: true })
    await app.stop()
  })

  describe('#isBanned', () => {
    beforeEach(async () => {
      console.log({ channelPhoneNumber, memberPhoneNumber })
      ban = await db.ban.create({ channelPhoneNumber, memberPhoneNumber })
      console.log(await db.ban.count())
    })
    describe('for a member who has been banned', () => {
      it('returns true', async () => {
        expect(await banRepository.isBanned(channelPhoneNumber, memberPhoneNumber)).to.eql(true)
      })
    })
  })
})
