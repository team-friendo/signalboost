import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
import recycleService from '../../../../app/registrar/phoneNumber/recycle'
import recycleRequestRepository from '../../../../app/db/repositories/recycleRequest'
// const {
//   job: { recyclePhoneNumberInterval, recycleGracePeriod },
// } = require('../../../../app/config')
describe('recycleablePhoneNumber repository', () => {
  const phoneNumber = genPhoneNumber()
  let db, recycleRequestCount, recycleStub

  before(async () => (db = (await app.run({ ...testApp, db: dbService })).db))
  beforeEach(
    async () => (recycleStub = sinon.stub(recycleService, 'recycle').returns(Promise.resolve())),
  )
  afterEach(async () => {
    await app.db.recycleRequest.destroy({ where: {} })
    sinon.restore()
  })
  after(async () => await app.stop())

  describe('issuing a recycle request', () => {
    describe('if recycle request does not yet exist', () => {
      beforeEach(async () => (recycleRequestCount = await db.recycleRequest.count()))

      it('creates new request and flags that it was created', async () => {
        const { recycleRequest, wasCreated } = await recycleRequestRepository.requestToRecycle(
          phoneNumber,
        )
        expect(wasCreated).to.eql(true)
        expect(recycleRequest.phoneNumber).to.eql(phoneNumber)
        expect(await app.db.recycleRequest.count()).to.eql(recycleRequestCount + 1)
      })
    })

    describe('if recycle request already exists for the phoneNumber', () => {
      beforeEach(async () => {
        await app.db.recycleRequest.create({ phoneNumber })
        recycleRequestCount = await db.recycleRequest.count()
      })

      it('does not create new request but returns existing request', async () => {
        const { recycleRequest, wasCreated } = await recycleRequestRepository.requestToRecycle(
          phoneNumber,
        )
        expect(wasCreated).to.eql(false)
        expect(recycleRequest.phoneNumber).to.eql(phoneNumber)
        expect(await app.db.recycleRequest.count()).to.eql(recycleRequestCount)
      })
    })
  })

  // xdescribe('recyclePhoneNumbers', () => {
  //   const now = moment()
  //   const reclaimedPhoneNumber = genPhoneNumber()
  //   const recycledPhoneNumber = genPhoneNumber()
  //   const pendingPhoneNumber = genPhoneNumber()
  //
  //   const reclaimedRecycleablePhoneNumber = {
  //     phoneNumber: reclaimedPhoneNumber,
  //     whenEnqueued: now.toISOString(),
  //     createdAt: now.subtract(recycleGracePeriod / 2, 'millis').toISOString(),
  //   }
  //   const recycledRecycleablePhoneNumber = {
  //     phoneNumber: genPhoneNumber(),
  //     whenEnqueued: now.toISOString(),
  //     createdAt: now.subtract(recycleGracePeriod + 1, 'millis').toISOString(),
  //   }
  //   const pendingRecycleablePhoneNumber = {
  //     phoneNumber: genPhoneNumber(),
  //     whenEnqueued: now.toISOString(),
  //     createdAt: now.subtract(recycleGracePeriod / 2, 'millis').toISOString(),
  //   }
  //
  //   const reclaimedMessageCount = messageCountFactory({
  //     phoneNumber: reclaimedPhoneNumber,
  //     updatedAt: now.toISOString(),
  //   })
  //   const recycledMessageCount = messageCountFactory({
  //     phoneNumber: recycledPhoneNumber,
  //     updatedAt: now.subtract(recycleGracePeriod + 2, 'millis'),
  //   })
  //   const pendingMessageCount = messageCountFactory({
  //     phoneNumber: pendingPhoneNumber,
  //     updatedAt: now.subtract(recycleGracePeriod + 2, 'millis'),
  //   })
  //
  //   beforeEach(async () => {
  //     ;[
  //       reclaimedRecycleablePhoneNumber,
  //       recycledRecycleablePhoneNumber,
  //       pendingRecycleablePhoneNumber,
  //     ].map(x => db.recycleablePhoneNumber.create(x))
  //     ;[reclaimedMessageCount, recycledMessageCount, pendingMessageCount].map(x =>
  //       db.messageCount.create(x),
  //     )
  //   })
  //
  //   describe('a recycleablePhoneNumber that has been used after being enqueued', () => {
  //     it('is dequeued', async () => {
  //       expect(
  //         await db.recycleablePhoneNumber.findOne({
  //           where: {
  //             phoneNumber: reclaimedPhoneNumber,
  //           },
  //         }),
  //       ).to.eql(null)
  //     })
  //     it('is not recycled', () => {
  //       expect(recycleStub.callCount).to.eql(0)
  //     })
  //   })
  //
  //   describe('a recycleablePhoneNumbers whose grace period has expired', () => {
  //     it('is dequeued', async () => {
  //       expect(
  //         (await db.recycleablePhoneNumber.findOne({
  //           where: {
  //             phoneNumber: recycledRecycleablePhoneNumber,
  //           },
  //         })).phoneNumber,
  //       ).to.eql(null)
  //     })
  //     it('it is recycled', () => {
  //       expect(recycleStub.callCount).to.eql(1)
  //       expect(recycleStub.getCall(0).args).to.eql([recycledRecycleablePhoneNumber])
  //     })
  //   })
  //
  //   describe('a recycleablePhoneNumber that has not been used and whose grace period has expired', () => {
  //     it('is not dequeued', async () => {
  //       expect(
  //         (await db.recycleablePhoneNumber.findOne({
  //           where: {
  //             phoneNumber: pendingPhoneNumber,
  //           },
  //         })).phoneNumber,
  //       ).to.eql(pendingPhoneNumber)
  //     })
  //     it('is not recycled', () => {
  //       expect(recycleStub.callCount).to.eql(0)
  //     })
  //   })
  // })
})
