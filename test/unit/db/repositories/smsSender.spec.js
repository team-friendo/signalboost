import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import { initDb } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import smsSenderRepository from '../../../../app/db/repositories/smsSender'
import { smsSenderFactory } from '../../../support/factories/smsSender'
const {
  twilio: { monthlySmsQuota },
} = require('../../../../app/config')

describe('smsSender repository', () => {
  const phoneNumber = genPhoneNumber()

  let db
  before(() => (db = initDb()))
  afterEach(() => db.smsSender.destroy({ where: {}, force: true }))
  after(() => db.sequelize.close())

  describe('#countMessage', () => {
    describe('when a sender has not sent any messages yet', () => {
      let result, smsSenderCount
      beforeEach(async () => {
        smsSenderCount = await db.smsSender.count()
        result = await smsSenderRepository.countMessage(db, phoneNumber)
      })

      it('creates a new smsSender record', async () => {
        expect(await db.smsSender.count()).to.be.above(smsSenderCount)
      })

      it('associates the record with the phone number of the sender', () => {
        expect(result.phoneNumber).to.eql(phoneNumber)
      })

      it('sets the messagesSent counter to 1', () => {
        expect(result.messagesSent).to.eql(1)
      })
    })

    describe('when a sender has sent a message', () => {
      let messagesSent
      beforeEach(async () => {
        await db.smsSender.create(smsSenderFactory({ phoneNumber }))
        messagesSent = (await db.smsSender.findOne({ where: { phoneNumber } })).messagesSent
      })

      it('increments the messagesSent counter', async () => {
        const result = await smsSenderRepository.countMessage(db, phoneNumber)
        const newCount = (await db.smsSender.findOne({ where: { phoneNumber } })).messagesSent

        expect(newCount).to.be.above(messagesSent)
        expect(result.messagesSent).to.eql(newCount)
      })
    })
  })

  describe('#hasReachedQuota', () => {
    it('returns false when sender has sent less than quota', async () => {
      await db.smsSender.create(
        smsSenderFactory({ phoneNumber, messagesSent: monthlySmsQuota - 1 }),
      )
      expect(await smsSenderRepository.hasReachedQuota(db, phoneNumber)).to.eql(false)
    })

    it('returns true when sender has sent messages equaling quota', async () => {
      await db.smsSender.create(smsSenderFactory({ phoneNumber, messagesSent: monthlySmsQuota }))
      expect(await smsSenderRepository.hasReachedQuota(db, phoneNumber)).to.eql(true)
    })

    it('returns true when sender has sent above quota', async () => {
      await db.smsSender.create(
        smsSenderFactory({ phoneNumber, messagesSent: monthlySmsQuota + 1 }),
      )
      expect(await smsSenderRepository.hasReachedQuota(db, phoneNumber)).to.eql(true)
    })
  })
})
