import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import fs from 'fs-extra'
import { initDb } from '../../app/db'
import { EventEmitter } from 'events'
import channelRepository from '../../app/db/repositories/channel'
import docker from '../../app/services/orchestrator/docker'
import channelService from '../../app/services/orchestrator/channel'

describe('initializing channels', () => {
  const phoneNumbers = [
    '+15122707190', // twilioSid: PNe16c14ae9942b36482d2c06bf5c0b4bf
    '+15129910157', // twilioSid: PNb25f527e5eb6f7cfcd02b695369ddac1,
  ]
  const staleContainerId = 'acabdeadbeef'
  const timeout = 60000
  const keystorePath = '/root/.config/signal/data'
  let db, emitter

  before(async function() {
    this.timeout(timeout)
    db = initDb()
    emitter = new EventEmitter()

    await Promise.all(phoneNumbers.map((phoneNumber, idx) => setupNumber(db, phoneNumber, idx)))
    await channelService.initialize({ db, emitter })
  })

  const setupNumber = (db, phoneNumber, idx) =>
    Promise.all([
      // ensure that initialize runs against both PURCHASED and VERIFIED phone numbers
      db.phoneNumber.findOrCreate({
        where: { phoneNumber },
        defaults: { status: idx === 0 ? 'PURCHASED' : 'VERIFIED' },
      }),
      // hide any traces of having been previously registered
      maybeMove(`${keystorePath}/${phoneNumber}`, `${keystorePath}/${phoneNumber}.bk`),
      maybeMove(`${keystorePath}/${phoneNumber}.d`, `${keystorePath}/${phoneNumber}.d.bk`),
      // make sure that channels exist, but give them obsolete containerIds (to simulate re-deploying from db state)
      db.channel.findOrCreate({
        where: { phoneNumber },
        defaults: { name: `test${idx}`, containerId: staleContainerId },
      }),
      // erase any traces of having been previously activated
      docker.stopContainer(phoneNumber),
    ])

  after(async function() {
    this.timeout(timeout)
    await Promise.all(phoneNumbers.map(phoneNumber => teardownNumber(db, phoneNumber)))
    await db.sequelize.close()
  })

  const teardownNumber = (db, phoneNumber) =>
    Promise.all([
      docker.stopContainer(phoneNumber),
      db.channel.destroy({ where: { phoneNumber } }),
      maybeMove(`${keystorePath}/${phoneNumber}.bk`, `${keystorePath}/${phoneNumber}`),
      maybeMove(`${keystorePath}/${phoneNumber}.d.bk`, `${keystorePath}/${phoneNumber}`),
    ])

  const maybeMove = async (src, dst) => {
    const [srcExists, dstExists] = await Promise.all([fs.pathExists(src), fs.pathExists(dst)])
    return srcExists && !dstExists && fs.move(src, dst)
  }

  describe('for each phone number', () => {
    phoneNumbers.forEach((phoneNumber, i) => {
      it(`creates or keeps a keystore for phone number [${i}]`, async () => {
        expect(await fs.pathExists(`${keystorePath}/${phoneNumber}`)).to.eql(true)
      })

      it(`starts a docker container for phone number [${i}]`, async () => {
        expect(await docker.getContainer(phoneNumber)).to.be.an('object')
      })

      it(`overwrites the containerId of the channel record for phone number [${i}]`, async () => {
        const channel = await channelRepository.findByPhoneNumber(db, phoneNumber)
        expect(channel.containerId).not.to.eql(staleContainerId)
      })

      it(`marks the phone numbers as ACTIVE for phone number [${i}]`, async () => {
        const pNum = await db.phoneNumber.findOne({ where: { phoneNumber } })
        expect(pNum.status).to.eql('ACTIVE')
      })
    })
  })
})
