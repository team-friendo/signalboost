import { describe, it, before, after, beforeEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import recycleablePhoneNumberRepository from '../../../../app/db/repositories/recycleablePhoneNumber'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
import recycleService from '../../../../app/registrar/phoneNumber/recycle'
import { messageCountFactory } from '../../../support/factories/messageCount'
import moment from 'moment'
const {
  job: { recyclePhoneNumberInterval, recycleGracePeriod },
} = require('../../../../app/config')
describe('recycleablePhoneNumber repository', () => {
  let db, recycleablePhoneNumberCount, channelPhoneNumber, recycleStub

  before(async () => {
    db = (await app.run({ ...testApp, db: dbService })).db
    channelPhoneNumber = genPhoneNumber()
  })

  beforeEach(async () => {
    recycleablePhoneNumberCount = await db.recycleablePhoneNumber.count()
    recycleStub = sinon.stub(recycleService, 'recycle').returns(Promise.resolve())
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

  describe('recyclePhoneNumbers', () => {
    const now = moment()
    const reclaimedPhoneNumber = genPhoneNumber()
    const recycledPhoneNumber = genPhoneNumber()
    const pendingPhoneNumber = genPhoneNumber()

    const reclaimedRecycleablePhoneNumber = {
      channelPhoneNumber: reclaimedPhoneNumber,
      whenEnqueued: now.toISOString(),
      createdAt: now.subtract(recycleGracePeriod / 2, 'millis').toISOString(),
    }
    const recycledRecycleablePhoneNumber = {
      channelPhoneNumber: genPhoneNumber(),
      whenEnqueued: now.toISOString(),
      createdAt: now.subtract(recycleGracePeriod + 1, 'millis').toISOString(),
    }
    const pendingRecycleablePhoneNumber = {
      channelPhoneNumber: genPhoneNumber(),
      whenEnqueued: now.toISOString(),
      createdAt: now.subtract(recycleGracePeriod / 2, 'millis').toISOString(),
    }

    const reclaimedMessageCount = messageCountFactory({
      channelPhoneNumber: reclaimedPhoneNumber,
      updatedAt: now.toISOString(),
    })
    const recycledMessageCount = messageCountFactory({
      channelPhoneNumber: recycledPhoneNumber,
      updatedAt: now.subtract(recycleGracePeriod + 2, 'millis'),
    })
    const pendingMessageCount = messageCountFactory({
      channelPhoneNumber: pendingPhoneNumber,
      updatedAt: now.subtract(recycleGracePeriod + 2, 'millis'),
    })

    beforeEach(async () => {
      ;[
        reclaimedRecycleablePhoneNumber,
        recycledRecycleablePhoneNumber,
        pendingRecycleablePhoneNumber,
      ].map(x => db.recycleablePhoneNumber.create(x))
      ;[reclaimedMessageCount, recycledMessageCount, pendingMessageCount].map(x =>
        db.messageCount.create(x),
      )
    })

    describe('a recycleablePhoneNumber that has been used after being enqueued', () => {
      it('is dequeued', async () => {
        expect(
          await db.recycleablePhoneNumber.findOne({
            where: {
              channelPhoneNumber: reclaimedPhoneNumber,
            },
          }),
        ).to.eql(null)
      })
      it('is not recycled', () => {
        expect(recycleStub.callCount).to.eql(0)
      })
    })

    describe('a recycleablePhoneNumbers whose grace period has expired', () => {
      it('is dequeued', async () => {
        expect(
          (await db.recycleablePhoneNumber.findOne({
            where: {
              channelPhoneNumber: recycledRecycleablePhoneNumber,
            },
          })).channelPhoneNumber,
        ).to.eql(null)
      })
      it('it is recycled', () => {
        expect(recycleStub.callCount).to.eql(1)
        expect(recycleStub.getCall(0).args).to.eql([recycledRecycleablePhoneNumber])
      })
    })

    describe('a recycleablePhoneNumber that has not been used and whose grace period has expired', () => {
      it('is not dequeued', async () => {
        expect(
          (await db.recycleablePhoneNumber.findOne({
            where: {
              channelPhoneNumber: pendingPhoneNumber,
            },
          })).channelPhoneNumber,
        ).to.eql(pendingPhoneNumber)
      })
      it('is not recycled', () => {
        expect(recycleStub.callCount).to.eql(0)
      })
    })
  })
})
