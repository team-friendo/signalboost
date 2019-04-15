import { expect } from 'chai'
import { describe, it, test, before, after } from 'mocha'
import { keys } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { welcomeFactory } from '../../../support/factories/welcome'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('welcome model', () => {
  let db, welcome

  before(async () => {
    db = initDb()
  })

  after(async () => {
    await db.welcome.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    welcome = await db.welcome.create(welcomeFactory())
    expect(keys(welcome.get())).to.have.members([
      'id',
      'channelPhoneNumber',
      'welcomedPhoneNumber',
      'createdAt',
      'updatedAt',
    ])
  })

  describe('validations', () => {
    it('does not allow a null channel phone number', async () => {
      const err = await db.messageCount.create({ channelPhoneNumber: null }).catch(e => e)
      expect(err.message).to.include('channelPhoneNumber cannot be null')
    })

    it('does not allow a null welcomed phone number', async () => {
      const err = await db.messageCount.create({ welcomedPhoneNumber: null }).catch(e => e)
      expect(err.message).to.include('channelPhoneNumber cannot be null')
    })
  })

  describe('associations', () => {
    before(async () => {
      const channel = await db.channel.create(channelFactory())
      welcome = await db.welcome.create({
        welcomedPhoneNumber: genPhoneNumber(),
        channelPhoneNumber: channel.phoneNumber,
      })
    })

    it('belongs to a channel', async () => {
      expect(await welcome.getChannel()).to.be.an('object')
    })
  })
})
