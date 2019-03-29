import { expect } from 'chai'
import { describe, it, before, beforeEach, afterEach, after } from 'mocha'
import { reverse, pick } from 'lodash'
import { initDb } from '../../../app/db'
import { genPhoneNumber, phoneNumberFactory } from '../../support/factories/phoneNumber'
import phoneNumberRepository from '../../../app/db/repositories/phoneNumber'

describe('phone number repository', () => {
  let db

  before(() => (db = initDb()))
  afterEach(() => db.phoneNumber.destroy({ where: {} }))
  after(async () => await db.sequelize.close())

  describe('#update', () => {
    let phoneNumber
    beforeEach(async () => {
      phoneNumber = await db.phoneNumber.create(phoneNumberFactory()).then(x => x.phoneNumber)
    })

    it('updates a phone number', async () => {
      await phoneNumberRepository.update(db, phoneNumber, {
        status: 'VERIFIED',
        twilioSid: 'deadbeef',
      })
      const foundPhoneNumber = await db.phoneNumber.findOne({ where: { phoneNumber } })
      expect(foundPhoneNumber.status).to.eql('VERIFIED')
      expect(foundPhoneNumber.twilioSid).to.eql('deadbeef')
    })
  })

  describe('#list', () => {
    let phoneNumberAttrs = [
      { phoneNumber: genPhoneNumber(), status: 'PURCHASED' },
      { phoneNumber: genPhoneNumber(), status: 'REGISTERED' },
      { phoneNumber: genPhoneNumber(), status: 'VERIFIED' },
      { phoneNumber: genPhoneNumber(), status: 'ACTIVE' },
    ]
    beforeEach(async () => {
      await Promise.all(phoneNumberAttrs.map(pn => db.phoneNumber.create(pn)))
    })

    it('retrieves a list of phone numbers, sorted by status (in descreasing order of activation level)', async () => {
      const pNumList = await phoneNumberRepository.list(db)
      expect(pNumList.map(pNum => pick(pNum, ['phoneNumber', 'status']))).to.eql(
        reverse(phoneNumberAttrs),
      )
    })
  })
})
