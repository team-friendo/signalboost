import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import request from 'supertest'
import { keys } from 'lodash'
import { run } from '../../app/db'
import { registrar } from '../../app/config/index'
import { statuses } from '../../app/db/models/phoneNumber'
import { genPhoneNumber, genSid } from '../support/factories/phoneNumber'
import { first, last, findIndex } from 'lodash'
import { deepChannelAttrs } from '../support/factories/channel'

describe('retrieving metrics', () => {
  const appUrl = `https://${process.env.SIGNALBOOST_HOST_URL}`
  let db, count, channels, phoneNumbers, response
  const phoneNumberAttributes = [
    { phoneNumber: genPhoneNumber(), twilioSid: genSid(), status: statuses.PURCHASED },
    { phoneNumber: genPhoneNumber(), twilioSid: genSid(), status: statuses.REGISTERED },
    { phoneNumber: genPhoneNumber(), twilioSid: genSid(), status: statuses.VERIFIED },
    { phoneNumber: genPhoneNumber(), twilioSid: genSid(), status: statuses.ACTIVE },
  ]

  before(async () => (db = await run()))
  after(async () => await db.stop())

  describe('listing channels', () => {
    before(async function() {
      this.timeout(10000)
      channels = await Promise.all(
        deepChannelAttrs.map(ch =>
          db.channel.create(
            { ...ch, phoneNumber: genPhoneNumber() },
            {
              include: [{ model: db.membership }, { model: db.messageCount }],
            },
          ),
        ),
      )
      count = await db.channel.count()
      /**********************************************************/
      response = await request(appUrl)
        .get('/channels')
        .set('Token', registrar.authToken)
      /**********************************************************/
    })
    after(async () => await Promise.all(channels.map(ch => ch.destroy())))

    it('provides a count of channels', () => {
      expect(response.body.count).to.eql(count)
    })

    it('lists all channels', () => {
      expect(response.body.channels.length).to.eql(count)
    })

    it('formats channel records correctly', () => {
      response.body.channels.forEach(ch => {
        expect(ch.phoneNumber).to.be.a('string')
        expect(ch.name).to.be.a('string')
        expect(ch.admins).to.be.a('number')
        expect(ch.subscribers).to.be.a('number')
        expect(ch.messageCount.broadcastIn).to.be.a('number')
        expect(ch.messageCount.commandIn).to.be.a('number')
        expect(ch.messageCount.hotlineIn).to.be.a('number')
      })
    })
  })

  describe('listing phone numbers', () => {
    before(async function() {
      this.timeout(10000)
      phoneNumbers = await db.phoneNumber.bulkCreate(phoneNumberAttributes, {
        returning: true,
      })
      count = await db.phoneNumber.count()
      response = await request(appUrl)
        .get('/phoneNumbers')
        .set('Token', registrar.authToken)
    })
    after(async () => await Promise.all(phoneNumbers.map(r => r.destroy())))

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
      response.body.phoneNumbers.forEach(pn => {
        expect(pn.phoneNumber).to.be.a('string')
        expect(pn.status).to.be.a('string')
        expect(keys(pn)).to.include('twilioSid')
      })
    })
  })
})
