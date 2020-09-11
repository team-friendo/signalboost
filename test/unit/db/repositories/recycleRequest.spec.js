import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import moment from 'moment'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
import recycleRequestRepository from '../../../../app/db/repositories/recycleRequest'
import util from '../../../../app/util'
import { values } from 'lodash'
const {
  job: { recycleGracePeriod },
} = require('../../../../app/config')

describe('recycleablePhoneNumber repository', () => {
  const phoneNumber = genPhoneNumber()
  let db, recycleRequestCount

  before(async () => (db = (await app.run({ ...testApp, db: dbService })).db))
  afterEach(async () => {
    await app.db.recycleRequest.destroy({ where: {} })
    await app.db.messageCount.destroy({ where: {} })
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

  describe('processing mature recycle requests', () => {
    const now = moment().clone()
    const gracePeriodStart = now.clone().subtract(recycleGracePeriod, 'ms')

    const phoneNumbers = {
      redeemed: genPhoneNumber(),
      toRecycle: genPhoneNumber(),
      pending: genPhoneNumber(),
    }

    const recycleRequests = {
      redeemed: {
        phoneNumber: phoneNumbers.redeemed,
        // mature (created before start of grace period)
        createdAt: gracePeriodStart.clone().subtract(1, 'ms'),
      },
      toRecycle: {
        phoneNumber: phoneNumbers.toRecycle,
        // mature (created before start of grace period)
        createdAt: gracePeriodStart.clone().subtract(1, 'ms'),
      },
      pending: {
        phoneNumber: phoneNumbers.pending,
        // not mature (created after start of grace period)
        createdAt: gracePeriodStart.clone().add(1, 'ms'),
      },
    }

    const messageCounts = {
      redeemed: {
        channelPhoneNumber: phoneNumbers.redeemed,
        // used during grace period
        updatedAt: gracePeriodStart.clone().add(1, 'ms'),
      },
      toRecycle: {
        channelPhoneNumber: phoneNumbers.toRecycle,
        // not used during grace perdiod
        updatedAt: gracePeriodStart.clone().subtract(1, 'ms'),
      },
      pending: {
        channelPhoneNumber: phoneNumbers.pending,
        // does not matter when last used (b/c not mature), but let's say during grace period
        updatedAt: gracePeriodStart.clone().add(1, 'ms'),
      },
    }

    beforeEach(async () => {
      sinon.stub(util, 'now').returns(now.clone())

      await Promise.all(
        values(recycleRequests).map(recycleRequest =>
          app.db.recycleRequest.create(recycleRequest).then(() =>
            app.db.sequelize.query(`
          update "recycleRequests"
            set "createdAt" = '${recycleRequest.createdAt.toISOString()}'
            where "phoneNumber" = '${recycleRequest.phoneNumber}';
          `),
          ),
        ),
      )

      await Promise.all(
        values(messageCounts).map(messageCount =>
          app.db.messageCount.create(messageCount).then(() =>
            app.db.sequelize.query(`
            update "messageCounts"
              set "updatedAt" = '${messageCount.updatedAt.toISOString()}'
              where "channelPhoneNumber" = '${messageCount.channelPhoneNumber}';
            `),
          ),
        ),
      )
    })

    it('retrieves all mature recycle requests and classifies them as redeemed or toRecycle', async () => {
      const res = await recycleRequestRepository.evaluateRecycleRequests(values(phoneNumbers))
      expect(res).to.eql({
        redeemed: [phoneNumbers.redeemed],
        toRecycle: [phoneNumbers.toRecycle],
      })
    })
  })
})
