import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { pick } from 'lodash'
import { initDb } from '../../app/db'
import channelRepository from '../../app/db/repositories/channel'
import { getContainer, stopContainer } from '../../app/services/orchestrator/docker'
import { activate } from '../../app/services/orchestrator/channel/activate'

describe('activating a channel', () => {
  const phoneNumber = '+15122707190' // twilioSid: PNe16c14ae9942b36482d2c06bf5c0b4bf
  const name = 'foo'
  const admins = ['+12223334444', '+13334445555']
  let db, container, channel, channelCount, adminCount

  before(async () => {
    db = initDb()

    await Promise.all([
      stopContainer(phoneNumber),
      db.administration.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.subscription.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.channel.destroy({ where: { phoneNumber } }),
      db.phoneNumber.findOrCreate({ where: { phoneNumber }, defaults: { status: 'VERIFIED' } }),
    ])

    channelCount = await db.channel.count()
    adminCount = await db.administration.count()

    /***********************************************/
    await activate({ db, phoneNumber, name, admins })
    /***********************************************/

    container = await getContainer(phoneNumber)
    channel = await channelRepository.findByPhoneNumber(db, phoneNumber)
  })

  after(async function() {
    this.timeout(30000)

    await Promise.all([
      stopContainer(phoneNumber),
      db.administration.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.subscription.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.channel.destroy({ where: { phoneNumber } }),
    ])

    await db.sequelize.close()
  })

  it("runs a docker container for the channel's dispatcher", async () => {
    expect(container).to.be.an('object')
  })

  it('creates a db record for the channel', async () => {
    expect(await db.channel.count()).to.eql(channelCount + 1)
  })

  it("stores the channel's phoneNumber, name, and containerId in the channel record", () => {
    expect(pick(channel, ['phoneNumber', 'name', 'containerId'])).to.eql({
      phoneNumber,
      name,
      containerId: container.Id,
    })
  })

  it('creates db records for the admins', async () => {
    expect(await db.administration.count()).to.eql(adminCount + 2)
  })

  it('stores the admin and channel phone numbers in the admin records', async () => {
    const administrations = await channel.getAdministrations()
    expect(
      administrations.map(a => pick(a, ['channelPhoneNumber', 'humanPhoneNumber'])),
    ).to.have.deep.members(
      admins.map(a => ({ channelPhoneNumber: phoneNumber, humanPhoneNumber: a })),
    )
  })

  it("updates the phone number's status to active", async () => {
    expect(await db.phoneNumber.findOne({ where: { phoneNumber } })).to.have.property(
      'status',
      'ACTIVE',
    )
  })
})
