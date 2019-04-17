import { expect } from 'chai'
import { describe, it, test, before, after } from 'mocha'
import { keys } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { administrationFactory } from '../../../support/factories/administration'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('administration model', () => {
  let db, administration

  before(async () => {
    db = initDb()
  })

  after(async () => {
    await db.administration.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    administration = await db.administration.create(administrationFactory())
    expect(keys(administration.get())).to.have.members([
      'id',
      'channelPhoneNumber',
      'humanPhoneNumber',
      'createdAt',
      'updatedAt',
    ])
  })

  describe('associations', () => {
    before(async () => {
      const channel = await db.channel.create(channelFactory())
      administration = await db.administration.create({
        humanPhoneNumber: genPhoneNumber(),
        channelPhoneNumber: channel.phoneNumber,
      })
    })

    it('belongs to a channel', async () => {
      expect(await administration.getChannel()).to.be.an('object')
    })
  })
})
