const { expect } = require('chai')
const { describe, it, before, beforeEach, after, afterEach } = require('mocha')
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
import eventRepository from '../../../../app/db/repositories/event'
import { sha256Hash } from '../../../../app/util'
import { eventTypes } from '../../../../app/db/models/event'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('events repository', () => {
  const phoneNumber = genPhoneNumber()
  let db, eventCount
  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
  })
  beforeEach(async () => (eventCount = await db.event.count()))
  afterEach(async () => await db.event.destroy({ where: {}, force: true }))
  after(async () => await app.stop())

  describe('#log', () => {
    it('logs event type and hash of phone number involved in event', async () => {
      const event = await eventRepository.log(eventTypes.CHANNEL_CREATED, phoneNumber)

      expect(await db.event.count()).to.eql(eventCount + 1)
      expect(event.type).to.eql(eventTypes.CHANNEL_CREATED)
      expect(event.phoneNumberHash).to.eql(sha256Hash(phoneNumber))
    })
  })
})
