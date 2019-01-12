import { expect } from 'chai'
import { describe, it, test, before, after } from 'mocha'
import { keys } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { phoneNumberFactory } from '../../../support/factories/phoneNumber'
import { statuses } from '../../../../app/db/models/phoneNumber'

describe('phoneNumber model', () => {
  let db, phoneNumber

  before(async () => {
    db = initDb()
  })

  after(async () => {
    await db.phoneNumber.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    phoneNumber = await db.phoneNumber.create(phoneNumberFactory())
    expect(keys(phoneNumber.get())).to.have.members([
      'phoneNumber',
      'status',
      'createdAt',
      'updatedAt',
    ])
  })

  describe('validations', () => {
    it('does not allow null phone numbers', async () => {
      const err = await db.phoneNumber.create({ phoneNumber: null }).catch(e => e)
      expect(err.message).to.include('phoneNumber cannot be null')
    })

    it('does not allow duplicate phone numbers', async () => {
      const attrs = phoneNumberFactory()
      const err = await db.channel.bulkCreate([attrs, attrs]).catch(e => e)
      expect(err.errors[0].message).to.eql('phoneNumber must be unique')
    })

    it('requires valid US phone number', async () => {
      const err = await db.phoneNumber.create({ phoneNumber: '111' }).catch(e => e)
      expect(err.message).to.include('must be 10 digit phone number')
    })

    it('allows white-listed set of statuses', () => {
      Object.values(statuses).forEach(async status => {
        await db.phoneNumber.create(phoneNumberFactory({ status }))
      })
    })

    it('rejects non-whitelisted statuses', async () => {
      const err = await db.phoneNumber
        .create(phoneNumberFactory({ status: 'foobar' }))
        .catch(e => e)
      expect(err.message).to.include('invalid input value for enum')
    })
  })
})
