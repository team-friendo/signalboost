import { expect } from 'chai'
import { describe, it, before, beforeEach, afterEach, after } from 'mocha'
import { pick } from 'lodash'
import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'

describe('phone number repository', () => {
  const {
    filters: { ACTIVE, INACTIVE },
  } = phoneNumberRepository
  let db

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
  })
  afterEach(async () => await db.phoneNumber.destroy({ where: {}, force: true }))
  after(async () => await app.stop())

  describe('#create', () => {
    it('creates a new phoneNubmer', async () => {
      let count = await db.phoneNumber.count()
      await phoneNumberRepository.create(phoneNumberFactory())
      expect(await db.phoneNumber.count()).to.eql(count + 1)
    })
  })

  describe('#update', () => {
    let phoneNumber
    beforeEach(async () => {
      phoneNumber = await db.phoneNumber.create(phoneNumberFactory()).then(x => x.phoneNumber)
    })

    it('updates a phone number', async () => {
      await phoneNumberRepository.update(phoneNumber, {
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

    describe('when given no filters', () => {
      it('retrieves a list of all phone numbers, sorted by activation level', async () => {
        const pNumList = await phoneNumberRepository.list()
        expect(pNumList.map(pNum => pick(pNum, ['phoneNumber', 'status']))).to.eql(
          phoneNumberAttrs.slice().reverse(),
        )
      })
    })

    describe('when given ACTIVE filter', () => {
      it('retrieves a list of ACTIVE phone numbers', async () => {
        const pNumList = await phoneNumberRepository.list(ACTIVE)
        expect(pNumList.map(pNum => pick(pNum, ['phoneNumber', 'status']))).to.eql(
          phoneNumberAttrs.slice(-1),
        )
      })
    })

    describe('when given INACTIVE filter', () => {
      it('retrieves a list of PURCHASED, REGISTERD, and VERIFIED phone numbers', async () => {
        const pNumList = await phoneNumberRepository.list(INACTIVE)
        expect(pNumList.map(pNum => pick(pNum, ['phoneNumber', 'status']))).to.eql(
          phoneNumberAttrs.slice(0, -1).reverse(),
        )
      })
    })
  })

  describe('#destroy', () => {
    const phoneNumber = genPhoneNumber()
    let phoneNumberCount

    describe('when given an existing phone number', () => {
      beforeEach(async () => {
        await db.phoneNumber.create(phoneNumberFactory({ phoneNumber }))
      })

      it('deletes the phone number', async () => {
        phoneNumberCount = await db.phoneNumber.count()
        expect(await phoneNumberRepository.destroy(phoneNumber)).to.eql(true)
        expect(await db.phoneNumber.count()).to.eql(phoneNumberCount - 1)
      })
    })

    describe('when given the phone number for a non-existent phoneNumber', () => {
      it('does nothing', async () => {
        phoneNumberCount = await db.phoneNumber.count()
        expect(await phoneNumberRepository.destroy(genPhoneNumber())).to.eql(false)
        expect(await db.phoneNumber.count()).to.eql(phoneNumberCount)
      })
    })
  })
})
