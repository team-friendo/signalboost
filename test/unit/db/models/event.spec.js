import { expect } from 'chai'
import { describe, it, before, after, afterEach, beforeEach } from 'mocha'
import { run } from '../../../../app/db/index'
import { eventFactory } from '../../../support/factories/event'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { Op, QueryTypes } from 'sequelize'

describe('events model', () => {
  let db

  before(async () => {
    db = await run()
  })
  afterEach(async () => {
    await db.event.destroy({ where: {} })
  })
  after(async () => {
    await db.stop()
  })

  it('has correct fields', async () => {
    const event = await db.event.create(eventFactory())
    expect(event.id).to.be.a('string')
    expect(event.type).to.be.a('string')
    expect(event.phoneNumberHash).to.be.a('string')
    expect(event.metadata).to.be.a('object') // jsonb
    expect(event.createdAt).to.be.a('Date')
    expect(event.updatedAt).to.be.a('Date')
  })

  describe('validations', () => {
    it('does not allow null type field', async () => {
      const err = await db.event.create(eventFactory({ type: undefined })).catch(e => e)
      expect(err.message).to.contain('cannot be null')
    })

    it('requires type to be a valid enum variant', async () => {
      const err = await db.event.create(eventFactory({ type: 'foobar' })).catch(e => e)
      expect(err.message).to.contain('invalid input value for enum')
    })

    it('does not allow null phoneNumberHash field', async () => {
      const err = await db.event.create(eventFactory({ phoneNumberHash: undefined })).catch(e => e)
      expect(err.message).to.contain('cannot be null')
    })

    it('requires phoneNumberHash to be a valid sha256 hash', async () => {
      const err = await db.event
        .create(eventFactory({ phoneNumberHash: genPhoneNumber() }))
        .catch(e => e)
      expect(err.message).to.contain('sha256 hash')
    })
  })

  describe('metadata field', () => {
    let events

    beforeEach(async () => {
      events = await Promise.all([
        db.event.create(
          eventFactory({
            metadata: undefined,
          }),
        ),
        db.event.create(
          eventFactory({
            metadata: {
              memberCount: 42,
              messageCount: {
                broadCastIn: 1,
                hotlineIn: 2,
                commandIn: 3,
              },
            },
          }),
        ),
      ])
    })

    it('provides null values for all fields if undefined', () => {
      expect(events[0].metadata).to.eql({})
    })

    it('allows selecting by value of nested JSON values in raw sql', async () => {
      const numWithMemberCounts = await db.sequelize
        .query(`select count(*) from events where metadata->>'memberCount' is not null;`, {
          type: QueryTypes.SELECT,
        })
        .then(([{ count }]) => parseInt(count))
      expect(numWithMemberCounts).to.eql(1)
    })

    it('allows selecting by value of nested JSON values in sequelize DSL', async () => {
      const numWithMemberCounts = await db.event.count({
        where: {
          metadata: {
            memberCount: { [Op.not]: null },
          },
        },
      })
      expect(numWithMemberCounts).to.eql(1)
    })

    it('allows parsing of nested JSON values queried in raw sql', async () => {
      const messageCount = await db.sequelize
        .query(
          `select (metadata->>'messageCount')::jsonb from events where metadata->>'messageCount' is not null;`,
          { type: QueryTypes.SELECT },
        )
        .then(([{ jsonb }]) => jsonb)
      expect(messageCount).to.eql({ broadCastIn: 1, hotlineIn: 2, commandIn: 3 })
    })

    it('allows parsing of nested JSON values queried in sequelize DSL', async () => {
      const messageCount = (await db.event.findAll())[1].metadata.messageCount
      expect(messageCount).to.eql({ broadCastIn: 1, hotlineIn: 2, commandIn: 3 })
    })
  })
})
