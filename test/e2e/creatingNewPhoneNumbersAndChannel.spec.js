import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import request from 'supertest'
import { pick } from 'lodash'
import { api } from '../../app/config/index'
import { run } from '../../app/db'
import { genPhoneNumber } from '../support/factories/phoneNumber'
const {
  twilio: { accountSid },
} = require('../../app/config')

describe.skip('creating new phone numbers for use in new channels', () => {
  /**
   * NOTE(aguestuser|Thu 10 Jan 2019):
   * - this test costs $$ ($1 for phone number 0.75 cents for the auth message
   * - it also risks getting our IP blocked by signal
   * - :. we keep it skipped but under version control for troubleshooting purposes
   * - please only run it if you think something is broken, or to check if a big refactor works
   * - thx! <@3
   **/
  const name = 'foo'
  const admins = [genPhoneNumber(), genPhoneNumber()]

  let db,
    phoneNumberResponse,
    channelResponse,
    phoneNumberCount,
    channelCount,
    publicationCount,
    messageCountCount

  const releaseNumber = twilioSid =>
    request('https://api.twilio.com').del(
      `/2010-04-01'/Accounts/${accountSid}/IncomingPhoneNumbers/${twilioSid}.json`,
    )

  const destroyPhoneNumber = phoneNumber =>
    Promise.all([
      db.publication.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.subscription.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.channel.destroy({ where: { phoneNumber } }),
      db.phoneNumber.destroy({ where: { phoneNumber } }),
    ])

  before(async () => {
    db = await run()
    phoneNumberCount = await db.phoneNumber.count()
    channelCount = await db.channel.count()
    publicationCount = await db.publication.count()
    messageCountCount = await db.messageCount.count()
  })

  after(async function() {
    this.timeout(30000)
    await Promise.all([
      ...phoneNumberResponse.body.map(({ phoneNumber }) => destroyPhoneNumber(phoneNumber)),
      ...phoneNumberResponse.body.map(({ twilioSid }) => releaseNumber(twilioSid)),
    ])
    await db.stop()
  })

  describe('creating phone numbers', () => {
    before(async function() {
      this.timeout(30000)
      phoneNumberResponse = await request('https://signalboost.ngrok.io')
        .post('/phoneNumbers')
        .set('token', api.authToken)
        .send({ areaCode: 202, num: 2 })
      console.log(
        '>>>> phoneNumberResponse >>>>>\n',
        JSON.stringify(phoneNumberResponse.body, null, '  '),
      )
    })

    it('adds two verified numbers to the database', async () => {
      expect(await db.phoneNumber.count({ where: { status: 'VERIFIED' } })).to.eql(
        phoneNumberCount + 2,
      )
    })

    describe('response to phone number creation request', () => {
      it('is an array of two results', () => {
        expect(phoneNumberResponse.body).to.have.length(2)
      })

      it('contains VERIFIED statuses', () => {
        phoneNumberResponse.body.forEach(r => expect(r.status).to.eql('VERIFIED'))
      })

      it('contains phone numbers with requested area code', () => {
        phoneNumberResponse.body.forEach(r => expect(r.phoneNumber).to.match(/^\+1202\d{7}$/))
      })
    })

    describe('creating a new channel', () => {
      let phoneNumber, channel

      before(async function() {
        this.timeout(30000)
        phoneNumber = phoneNumberResponse.body[0].phoneNumber

        channelResponse = await request('https://signalboost.ngrok.io')
          .post('/channels')
          .set('Token', api.authToken)
          .send({ phoneNumber, name, admins })

        channel = await db.channel.findOne({ where: { phoneNumber } })
        console.log(
          '>>>>>>> channelResponse >>>>>>>\n',
          JSON.stringify(channelResponse.body, null, '  '),
        )
      })

      it('creates a db record for the channel', async () => {
        expect(await db.channel.count()).to.eql(channelCount + 1)
        expect(pick(channel, ['phoneNumber', 'name', 'containerId'])).to.eql({
          phoneNumber,
          name,
        })
      })

      it('creates db records for the channel admins', async () => {
        expect(await db.publication.count()).to.eql(publicationCount + 2)
        expect((await channel.getPublications()).map(p => p.adminPhoneNumber)).to.have.members(
          admins,
        )
      })

      it('creates a db record for the channel messageCounts', async () => {
        expect(await db.messageCount.count()).to.eql(messageCountCount + 1)
      })

      it("updates the phone number's status to active", async () => {
        expect(await db.phoneNumber.findOne({ where: { phoneNumber } })).to.have.property(
          'status',
          'ACTIVE',
        )
      })

      it('returns a success status JSON blob', () => {
        expect(channelResponse.body).to.eql({
          status: 'ACTIVE',
          name: 'foo',
          phoneNumber,
          admins,
        })
      })
    })
  })
})

/**
 * HOW TO DELETE A PHONE NUMBER
 *
 * curl -s -X DELETE \
 * -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
 * https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${phone_number_sid}.json
 **/
