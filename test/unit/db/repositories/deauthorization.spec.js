import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { times } from 'lodash'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { genFingerprint } from '../../../support/factories/deauthorization'
import deauthorizationRepository from '../../../../app/db/repositories/deauthorization'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'

describe('deauthorization repository', () => {
  const [channelPhoneNumber, memberPhoneNumber] = times(2, genPhoneNumber)
  const fingerprint = genFingerprint()
  let db, deauthCount

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
  })
  beforeEach(async () => (deauthCount = await db.deauthorization.count()))
  afterEach(async () => await db.deauthorization.destroy({ where: {}, force: true }))
  after(async () => await app.stop())

  it('creates a deauthorization record', async () => {
    let d = await deauthorizationRepository.create(
      channelPhoneNumber,
      memberPhoneNumber,
      fingerprint,
    )
    expect(await db.deauthorization.count()).to.eql(deauthCount + 1)
    expect(d.channelPhoneNumber).to.eql(channelPhoneNumber)
    expect(d.memberPhoneNumber).to.eql(memberPhoneNumber)
    expect(d.fingerprint).to.eql(fingerprint)
  })

  it('destroys a deauhtorization record', async () => {
    await deauthorizationRepository.create(channelPhoneNumber, memberPhoneNumber, fingerprint)
    await deauthorizationRepository.destroy(channelPhoneNumber, memberPhoneNumber)
    expect(await db.deauthorization.count()).to.eql(deauthCount)
  })
})
