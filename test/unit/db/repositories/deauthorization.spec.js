import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { times } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { genFingerprint } from '../../../support/factories/deauthorization'
import deauthorizationRepository from '../../../../app/db/repositories/deauthorization'

describe('deauthorization repository', () => {
  const [channelPhoneNumber, memberPhoneNumber] = times(2, genPhoneNumber)
  const fingerprint = genFingerprint()
  let db, deauthCount

  before(() => (db = initDb()))
  beforeEach(async () => (deauthCount = await db.deauthorization.count()))
  afterEach(async () => await db.deauthorization.destroy({ where: {}, force: true }))
  after(async () => await db.sequelize.close())

  it('creates a deauthorization record', async () => {
    let d = await deauthorizationRepository.create(
      db,
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
    await deauthorizationRepository.create(
      db,
      channelPhoneNumber,
      memberPhoneNumber,
      fingerprint,
    )
    await deauthorizationRepository.destroy(db, channelPhoneNumber, memberPhoneNumber)
    expect(await db.deauthorization.count()).to.eql(deauthCount)
  })
})
