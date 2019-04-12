import { expect } from 'chai'
import { describe, it, test, before, after } from 'mocha'
import { keys, values, pick } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { messageCountFactory } from '../../../support/factories/messageCount'

import { statuses } from '../../../../app/db/models/phoneNumber'

describe('phoneNumber model', () => {
  let db, phoneNumber

  before(async () => {
    db = initDb()
  })

  after(async () => {
    await db.messageCount.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    phoneNumber = await db.messageCount.create(messageCountFactory())
    expect(keys(phoneNumber.get())).to.have.deep.members([
      'phoneNumber',
      'broadcastIn',
      'broadcastOut',
      'commandIn',
      'commandOut',
      'createdAt',
      'updatedAt',
    ])
  })

  describe('validations', () => {
    it('does not allow null phone numbers', async () => {
      const err = await db.messageCount.create({ phoneNumber: null }).catch(e => e)
      expect(err.message).to.include('phoneNumber cannot be null')
    })

    it('provides default values for all counts', async () => {
      const result = await db.messageCount.create({ phoneNumber: genPhoneNumber() })
      expect(
        values(pick(result, ['broadcastIn', 'broadcastOut', 'commandIn', 'commandOut'])),
      ).to.eql([0, 0, 0, 0])
    })
  })
})
