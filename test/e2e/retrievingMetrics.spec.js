import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import request from 'supertest'
import { initDb } from '../../app/db'
import { orchestrator } from '../../app/config/index'
import { statuses } from '../../app/db/models/phoneNumber'
import { genPhoneNumber, genSid } from '../support/factories/phoneNumber'
import { keys, first, last, findIndex } from 'lodash'

describe('retrieving metrics', () => {
  let db, count, phoneNumberRecords, response
  const phoneNumberAttributes = [
    { phoneNumber: genPhoneNumber(), twilioSid: genSid(), status: statuses.PURCHASED },
    { phoneNumber: genPhoneNumber(), twilioSid: genSid(), status: statuses.REGISTERED },
    { phoneNumber: genPhoneNumber(), twilioSid: genSid(), status: statuses.VERIFIED },
    { phoneNumber: genPhoneNumber(), twilioSid: genSid(), status: statuses.ACTIVE },
  ]

  before(async () => (db = initDb()))
  after(async () => await db.sequelize.close())

  describe('listing phone numbers', () => {
    before(async function() {
      this.timeout(5000)
      phoneNumberRecords = await db.phoneNumber.bulkCreate(phoneNumberAttributes, {
        returning: true,
      })
      count = await db.phoneNumber.count()
      response = await request('https://signalboost.ngrok.io')
        .get('/phoneNumbers')
        .set('Token', orchestrator.authToken)
    })
    after(async () => await Promise.all(phoneNumberRecords.map(r => r.destroy())))

    it('provides a count of phone numbers', () => {
      expect(response.body.count).to.eql(count)
    })

    it('lists all phone numbers', () => {
      expect(response.body.phoneNumbers.length).to.eql(count)
    })

    it('sorts list of numbers by descending level of activiation', () => {
      const respNums = response.body.phoneNumbers

      expect(first(respNums).status).to.eql(statuses.ACTIVE)
      expect(last(respNums).status).to.eql(statuses.PURCHASED)

      const [regIdx, verIdx] = [statuses.REGISTERED, statuses.VERIFIED].map(status =>
        findIndex(respNums, num => num.status === status),
      )
      expect(verIdx < regIdx)
    })

    it('includes the phone number, twilio sid, and created dates for each number', () => {
      expect(
        response.body.phoneNumbers.forEach(pn => {
          expect(keys(pn)).to.include('phoneNumber')
          expect(keys(pn)).to.include('twilioSid')
          expect(keys(pn)).to.include('createdAt')
        }),
      )
    })
  })
})
