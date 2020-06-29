import { describe, it, before, after, beforeEach } from 'mocha'
import { expect } from 'chai'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import recycleablePhoneNumberRepository from '../../../../app/db/repositories/recycleablePhoneNumber'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'

describe('recycleablePhoneNumber repository', () => {
  let db, recycleablePhoneNumberCount, channelPhoneNumber

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
    channelPhoneNumber = genPhoneNumber()
  })

  beforeEach(async () => {
    recycleablePhoneNumberCount = await db.recycleablePhoneNumber.count()
  })

  after(async () => await app.stop())

  it('enqueues a channel for recycling', async () => {
    let enqueuedChannel = await recycleablePhoneNumberRepository.enqueue(channelPhoneNumber)
    expect(enqueuedChannel.channelPhoneNumber).to.eql(channelPhoneNumber)
    expect(await db.recycleablePhoneNumber.count()).to.eql(recycleablePhoneNumberCount + 1)
  })

  it('dequeues a channel for recycling', async () => {
    await recycleablePhoneNumberRepository.dequeue(channelPhoneNumber)
    expect(await db.recycleablePhoneNumber.count()).to.eql(recycleablePhoneNumberCount - 1)
  })
})
