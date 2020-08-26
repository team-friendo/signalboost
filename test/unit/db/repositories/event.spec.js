import { membershipFactory } from '../../../support/factories/membership'

const { expect } = require('chai')
const { describe, it, before, beforeEach, after, afterEach } = require('mocha')
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
import eventRepository from '../../../../app/db/repositories/event'
import { sha256Hash } from '../../../../app/util'
import { eventTypes } from '../../../../app/db/models/event'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { times } from 'lodash'

describe('events repository', () => {
  const memberPhoneNumber = genPhoneNumber()
  let db, eventCount
  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
  })
  beforeEach(async () => (eventCount = await db.event.count()))
  afterEach(async () => {
    await Promise.all([
      db.event.destroy({ where: {}, force: true }),
      db.membership.destroy({ where: {}, force: true }),
    ])
  })
  after(async () => await app.stop())

  describe('#log', () => {
    it('logs event type and hash of phone number involved in event', async () => {
      const event = await eventRepository.log(eventTypes.CHANNEL_CREATED, memberPhoneNumber)

      expect(await db.event.count()).to.eql(eventCount + 1)
      expect(event.type).to.eql(eventTypes.CHANNEL_CREATED)
      expect(event.phoneNumberHash).to.eql(sha256Hash(memberPhoneNumber))
    })
  })

  describe('#logIfFirstMembership', () => {
    describe('given a phone number with only one existing memberships', () => {
      beforeEach(async () => {
        await db.membership.create(membershipFactory({ memberPhoneNumber }))
      })

      it('logs a MEMBER_CREATED event', async () => {
        expect((await eventRepository.logIfFirstMembership(memberPhoneNumber)).type).to.eql(
          eventTypes.MEMBER_CREATED,
        )
        expect(await db.event.count()).to.eql(eventCount + 1)
      })
    })

    describe('given a phone number with many existing memberships', () => {
      beforeEach(async () => {
        await Promise.all(
          times(2, () => db.membership.create(membershipFactory({ memberPhoneNumber }))),
        )
      })

      it('does not create a log entry', async () => {
        expect(await eventRepository.logIfFirstMembership(memberPhoneNumber)).to.eql(null)
        expect(await db.event.count()).to.eql(eventCount)
      })
    })
  })

  describe('#logIfLastMembership', () => {
    describe('given a phone number with no remaining memberships', () => {
      it('creates a MEMBER_DESTROYED event', async () => {
        expect((await eventRepository.logIfLastMembership(memberPhoneNumber)).type).to.eql(
          eventTypes.MEMBER_DESTROYED,
        )
        expect(await db.event.count()).to.eql(eventCount + 1)
      })
    })

    describe('given a phone number with any remaining memberships', () => {
      beforeEach(async () => {
        await db.membership.create(membershipFactory({ memberPhoneNumber }))
      })

      it('does not create a log entry', () => {
        it('does not create a log entry', async () => {
          expect((await eventRepository.logIfLastMembership(memberPhoneNumber)).type).to.eql(null)
          expect(await db.event.count()).to.eql(eventCount)
        })
      })
    })
  })
})
