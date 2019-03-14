import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import fs from 'fs-extra'
import sinon from 'sinon'
import { initDb } from '../../app/db'
import { EventEmitter } from 'events'
import channelRepository from '../../app/db/repositories/channel'
import docker from '../../app/services/orchestrator/docker'
import channelService from '../../app/services/orchestrator/channel'
import logger from '../../app/services/orchestrator/logger'
const {
  signal: { keystorePath },
} = require('../../app/config')

describe('initializing channels', () => {
  const phoneNumbers = [
    '+15122707190', // twilioSid: PNe16c14ae9942b36482d2c06bf5c0b4bf
    '+15129910157', // twilioSid: PNb25f527e5eb6f7cfcd02b695369ddac1,
  ]
  const staleContainerId = 'acabdeadbeef'
  const timeout = 60000
  let db, emitter, loggerSpy

  before(async function() {
    this.timeout(timeout)
    db = initDb()
    emitter = new EventEmitter()
    loggerSpy = sinon.spy(logger, 'log')

    await Promise.all(phoneNumbers.map((phoneNumber, idx) => setupNumber(db, phoneNumber, idx)))
    await channelService.initialize({ db, emitter })
  })

  const setupNumber = (db, phoneNumber, idx) =>
    Promise.all([
      // ensure that initialize runs against both PURCHASED and VERIFIED phone numbers
      db.phoneNumber.findOrCreate({
        where: { phoneNumber },
        defaults: { status: idx === 0 ? 'VERIFIED' : 'REGISTERED' },
      }),
      // hide any traces of having been previously registered
      // TODO: leaving one to register costs $$$ (via twilio fees), consider omitting
      idx !== 0 && maybeMove(`${keystorePath}/${phoneNumber}`, `${keystorePath}/${phoneNumber}.bk`),
      idx !== 0 && maybeMove(`${keystorePath}/${phoneNumber}.d`, `${keystorePath}/${phoneNumber}.d.bk`),
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
    if (srcExists) {
      if (!dstExists) {
        return fs.move(src, dst)
      } else {
        await fs.remove(dst)
        return fs.move(src, dst)
      }
    } else {
      return Promise.resolve()
    }
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

  it('only attempts to register unregistered numbers', () => {
    expect(loggerSpy.getCall(1).args[0]).not.to.include(phoneNumbers[0])
    expect(loggerSpy.getCall(1).args[0]).to.include(phoneNumbers[1])
  })
})
