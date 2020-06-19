import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { run } from '../../../../app/db/index'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { defaultLanguage } from '../../../../app/config'
import { membershipFactory } from '../../../support/factories/membership'

describe('membership model', () => {
  let db, membership

  before(async () => {
    db = await run()
  })

  after(async () => {
    await db.membership.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.stop()
  })

  it('has correct fields', async () => {
    membership = await db.membership.create(membershipFactory())

    expect(membership.id).to.be.a('string')
    expect(membership.channelPhoneNumber).to.be.a('string')
    expect(membership.memberPhoneNumber).to.be.a('string')
    expect(membership.type).to.be.a('string')
    expect(membership.language).to.be.a('string')
    expect(membership.createdAt).to.be.a('Date')
    expect(membership.updatedAt).to.be.a('Date')
  })

  describe('defaults', () => {
    it('sets language to DEFAULT_LANGUAGE if none is provided', async () => {
      const sub = await db.membership.create(membershipFactory({ language: undefined }))
      expect(sub.language).to.eql(defaultLanguage)
    })
  })

  describe('validations', () => {
    it('does not allow memberships without a type', async () => {
      const result = await db.membership
        .create(membershipFactory({ type: undefined }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('cannot be null')
    })

    it('does not allow dupe memberships on same channel', async () => {
      const memberPhoneNumber = genPhoneNumber()
      const channelPhoneNumber = genPhoneNumber()
      await db.membership.create(
        membershipFactory({ channelPhoneNumber, memberPhoneNumber, type: 'ADMIN' }),
      )
      const result = await db.membership
        .create(membershipFactory({ channelPhoneNumber, memberPhoneNumber, type: 'SUBSCRIBER' }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('unique')
    })

    it('does not allow invalid channel phone numbers', async () => {
      const result = await db.membership
        .create(membershipFactory({ channelPhoneNumber: 'foo' }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('phone number')
    })

    it('does not allow invalid member phone numbers', async () => {
      const result = await db.membership
        .create(membershipFactory({ memberPhoneNumber: 'foo' }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('phone number')
    })
  })

  describe('associations', () => {
    before(async () => {
      const channel = await db.channel.create(channelFactory())
      membership = await db.membership.create(
        membershipFactory({
          channelPhoneNumber: channel.phoneNumber,
        }),
      )
    })

    it('belongs to a channel', async () => {
      expect(await membership.getChannel()).to.be.an('object')
    })
  })
})
