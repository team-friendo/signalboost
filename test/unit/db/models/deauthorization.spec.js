import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { run } from '../../../../app/db/index'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { deauthorizationFactory } from '../../../support/factories/deauthorization'

describe('deauthorization model', () => {
  let db, deauthorization

  before(async () => {
    db = await run()
  })

  after(async () => {
    await db.deauthorization.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.stop()
  })

  it('has correct fields', async () => {
    deauthorization = await db.deauthorization.create(deauthorizationFactory())
    expect(deauthorization.id).to.be.a('string')
    expect(deauthorization.channelPhoneNumber).to.be.a('string')
    expect(deauthorization.memberPhoneNumber).to.be.a('string')
    expect(deauthorization.fingerprint).to.be.a('string')
    expect(deauthorization.createdAt).to.be.a('Date')
    expect(deauthorization.updatedAt).to.be.a('Date')
  })

  describe('validations', () => {
    it('does not allow deauthorizations without a fingerprint', async () => {
      const result = await db.deauthorization
        .create(deauthorizationFactory({ fingerprint: undefined }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('cannot be null')
    })

    it('does not allow dupe deauthorizations on same channel', async () => {
      const memberPhoneNumber = genPhoneNumber()
      const channelPhoneNumber = genPhoneNumber()
      await db.deauthorization.create(
        deauthorizationFactory({ channelPhoneNumber, memberPhoneNumber, fingerprint: 'foo' }),
      )
      const result = await db.deauthorization
        .create(
          deauthorizationFactory({ channelPhoneNumber, memberPhoneNumber, fingerprint: 'foo' }),
        )
        .catch(a => a)
      expect(result.errors[0].message).to.include('unique')
    })

    it('does not allow invalid channel phone numbers', async () => {
      const result = await db.deauthorization
        .create(deauthorizationFactory({ channelPhoneNumber: 'foo' }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('phone number')
    })

    it('does not allow invalid member phone numbers', async () => {
      const result = await db.deauthorization
        .create(deauthorizationFactory({ memberPhoneNumber: 'foo' }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('phone number')
    })
  })

  describe('associations', () => {
    before(async () => {
      const channel = await db.channel.create(channelFactory())
      deauthorization = await db.deauthorization.create(
        deauthorizationFactory({
          channelPhoneNumber: channel.phoneNumber,
        }),
      )
    })

    it('belongs to a channel', async () => {
      expect(await deauthorization.getChannel()).to.be.an('object')
    })
  })
})
