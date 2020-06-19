import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import moment from 'moment'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { hotlineMessageFactory } from '../../../support/factories/hotlineMessages'
import { channelFactory } from '../../../support/factories/channel'
import hotlineMessageRepository from '../../../../app/db/repositories/hotlineMessage'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
const {
  job: { hotlineMessageExpiryInMillis },
} = require('../../../../app/config')

describe('hotlineMessage repository', () => {
  const [memberPhoneNumber, memberPhoneNumber2] = [genPhoneNumber(), genPhoneNumber()]
  let db, channelPhoneNumber, hotlineMessage

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
    channelPhoneNumber = (await db.channel.create(channelFactory())).phoneNumber
  })

  afterEach(() => db.hotlineMessage.destroy({ where: {}, force: true }))

  after(async () => {
    await db.channel.destroy({ where: {}, force: true })
    await app.stop()
  })

  describe('#getMessageId', () => {
    beforeEach(async () => {
      hotlineMessage = await db.hotlineMessage.create(
        hotlineMessageFactory({ channelPhoneNumber, memberPhoneNumber }),
      )
    })

    describe('for a member who has already sent a message to the channel', () => {
      it('retrieves the existing hotline message id number', async () => {
        expect(
          await hotlineMessageRepository.getMessageId({ channelPhoneNumber, memberPhoneNumber }),
        ).to.eql(hotlineMessage.id)
      })
    })

    describe('for a member who has not yet sent a message to the channel', () => {
      it('creates and returns a new hotline message id number', async () => {
        expect(
          await hotlineMessageRepository.getMessageId({
            channelPhoneNumber,
            memberPhoneNumber: memberPhoneNumber2,
          }),
        ).to.be.above(hotlineMessage.id)
      })
    })
  })

  describe('#findMemberPhoneNumber', () => {
    describe('when a hotline message record exists for given id and channelPhoneNumber', () => {
      beforeEach(async () => {
        hotlineMessage = await db.hotlineMessage.create(
          hotlineMessageFactory({ channelPhoneNumber, memberPhoneNumber }),
        )
      })

      it('resolves a promise with the corresponding member phone number', async () => {
        expect(await hotlineMessageRepository.findMemberPhoneNumber(hotlineMessage.id)).to.eql(
          memberPhoneNumber,
        )
      })
    })

    describe('when hotline message does not exist', () => {
      it('rejects a promise with an error', async () => {
        const err = await hotlineMessageRepository.findMemberPhoneNumber(-1).catch(e => e)
        expect(err).to.be.an('error')
      })
    })
  })

  describe('#deleteExpired', () => {
    let count
    beforeEach(async () => {
      // create 2 hotlineMessage records, make one of them expired
      await db.hotlineMessage.create(hotlineMessageFactory({ channelPhoneNumber }))
      const second = await db.hotlineMessage.create(hotlineMessageFactory({ channelPhoneNumber }))
      await db.hotlineMessage.update(
        { createdAt: moment().subtract(hotlineMessageExpiryInMillis + 10, 'ms') },
        { where: { id: second.id } },
      )
      count = await db.hotlineMessage.count()
    })

    it('deletes all hotlineMessage records older than expiry time', async () => {
      expect(await hotlineMessageRepository.deleteExpired()).to.eql(1)
      expect(await db.hotlineMessage.count()).to.eql(count - 1)
    })
  })
})
