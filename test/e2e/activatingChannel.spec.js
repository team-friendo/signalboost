import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { pick, omit } from 'lodash'
import request from 'supertest'
import { initDb } from '../../app/db'
import { orchestrator } from '../../app/config/index'
import channelRepository from '../../app/db/repositories/channel'
import { getContainer, stopContainer } from '../../app/services/orchestrator/docker'
import { genPhoneNumber } from '../support/factories/phoneNumber'

describe('activating a channel', () => {
  const timeout = 20000
  const phoneNumber = genPhoneNumber()
  const name = 'foo'
  const admins = ['+12223334444', '+13334445555']
  let db, container, channel, channelCount, adminCount, response

  before(async function() {
    this.timeout(timeout)
    db = initDb()

    await Promise.all([
      stopContainer(phoneNumber),
      db.publication.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.subscription.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.channel.destroy({ where: { phoneNumber } }),
      db.phoneNumber.findOrCreate({ where: { phoneNumber }, defaults: { status: 'VERIFIED' } }),
    ])

    channelCount = await db.channel.count()
    adminCount = await db.publication.count()

    /***********************************************/
    response = await request('https://signalboost.ngrok.io')
      .post('/channels')
      .set('Token', orchestrator.authToken)
      .send({ phoneNumber, name, admins })
    /***********************************************/

    container = await getContainer(phoneNumber)
    channel = await channelRepository.findByPhoneNumber(db, phoneNumber)
  })

  after(async function() {
    this.timeout(timeout)

    await Promise.all([
      stopContainer(phoneNumber),
      db.publication.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.subscription.destroy({ where: { channelPhoneNumber: phoneNumber } }),
      db.channel.destroy({ where: { phoneNumber } }),
      db.phoneNumber.destroy({ where: { phoneNumber } }),
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
    expect(await db.publication.count()).to.eql(adminCount + 2)
  })

  it('stores the admin and channel phone numbers in the admin records', async () => {
    const publications = await channel.getPublications()
    expect(
      publications.map(a => pick(a, ['channelPhoneNumber', 'publisherPhoneNumber'])),
    ).to.have.deep.members(
      admins.map(a => ({ channelPhoneNumber: phoneNumber, publisherPhoneNumber: a })),
    )
  })

  it("updates the phone number's status to active", async () => {
    expect(await db.phoneNumber.findOne({ where: { phoneNumber } })).to.have.property(
      'status',
      'ACTIVE',
    )
  })

  it('returns a success status JSON blob', () => {
    expect(omit(response.body, ['createdAt', 'updatedAt'])).to.eql({
      status: 'ACTIVE',
      name: 'foo',
      phoneNumber,
      twilioSid: null,
      admins: ['+12223334444', '+13334445555'],
    })
    expect(response.body.createdAt).to.be.a('string')
    expect(response.body.updatedAt).to.be.a('string')
  })
})
