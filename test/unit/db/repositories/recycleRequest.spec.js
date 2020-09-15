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
import { times, values } from 'lodash'
import { channelFactory } from '../../../support/factories/channel'
import { Op } from 'sequelize'
const {
  job: { recycleGracePeriod },
} = require('../../../../app/config')

describe('recycleablePhoneNumber repository', () => {
  const channelPhoneNumber = genPhoneNumber()
  let db, recycleRequestCount

  before(async () => (db = (await app.run({ ...testApp, db: dbService })).db))
  beforeEach(async () => {
    await db.channel.create(channelFactory({ phoneNumber: channelPhoneNumber }))
  })
  afterEach(async () => {
    await app.db.recycleRequest.destroy({ where: {} })
    await app.db.messageCount.destroy({ where: {} })
    await app.db.channel.destroy({ where: {} })
    sinon.restore()
  })
  after(async () => await app.stop())

  describe('#requestToRecycle', () => {
    describe('if recycle request does not yet exist for given channel phone number', () => {
      beforeEach(async () => (recycleRequestCount = await db.recycleRequest.count()))

      it('creates new request and flags that it was created', async () => {
        const { recycleRequest, wasCreated } = await recycleRequestRepository.requestToRecycle(
          channelPhoneNumber,
        )
        expect(wasCreated).to.eql(true)
        expect(recycleRequest.channelPhoneNumber).to.eql(channelPhoneNumber)
        expect(await app.db.recycleRequest.count()).to.eql(recycleRequestCount + 1)
      })
    })

    describe('if recycle request already exists for given channel phone number', () => {
      beforeEach(async () => {
        await app.db.recycleRequest.create({ channelPhoneNumber })
        recycleRequestCount = await db.recycleRequest.count()
      })

      it('does not create new request but returns existing request', async () => {
        const { recycleRequest, wasCreated } = await recycleRequestRepository.requestToRecycle(
          channelPhoneNumber,
        )
        expect(wasCreated).to.eql(false)
        expect(recycleRequest.channelPhoneNumber).to.eql(channelPhoneNumber)
        expect(await app.db.recycleRequest.count()).to.eql(recycleRequestCount)
      })
    })
  })

  describe('#destroy', () => {
    beforeEach(async () => {
      await app.db.recycleRequest.create({ channelPhoneNumber })
      recycleRequestCount = await db.recycleRequest.count()
    })

    describe('when given the phone number of an existing recycle request', () => {
      it('destroys the recycle request', async () => {
        expect(await recycleRequestRepository.destroy(channelPhoneNumber)).to.eql(1)
        expect(await db.recycleRequest.count()).to.eql(recycleRequestCount - 1)
        expect(await db.recycleRequest.findOne({ where: { channelPhoneNumber } })).to.be.null
      })
    })
    describe('when given a random phone number', () => {
      it('does nothing', async () => {
        expect(await recycleRequestRepository.destroy(genPhoneNumber())).to.eql(0)
        expect(await db.recycleRequest.count()).to.eql(recycleRequestCount)
        expect(await db.recycleRequest.findOne({ where: { channelPhoneNumber } })).not.to.be.null
      })
    })
  })

  describe('#destroyMany', () => {
    const toBeDeleted = times(3, genPhoneNumber)
    const toBeIgnored = times(2, genPhoneNumber)
    const allNumbers = [...toBeDeleted, ...toBeIgnored]
    beforeEach(async () => {
      await Promise.all(
        allNumbers.map(channelPhoneNumber =>
          db.channel.create(channelFactory({ phoneNumber: channelPhoneNumber })),
        ),
      )
      await Promise.all(
        allNumbers.map(channelPhoneNumber => db.recycleRequest.create({ channelPhoneNumber })),
      )
      recycleRequestCount = await db.recycleRequest.count()
    })
    it('deletes all recycle requests with phone numbers in a given list', async () => {
      expect(await recycleRequestRepository.destroyMany(toBeDeleted)).to.eql(toBeDeleted.length)
      expect(await db.recycleRequest.count()).to.eql(recycleRequestCount - toBeDeleted.length)
      expect(
        await db.recycleRequest.findAll({ where: { channelPhoneNumber: { [Op.in]: toBeDeleted } } }),
      ).to.have.length(0)
      expect(
        await db.recycleRequest.findAll({ where: { channelPhoneNumber: { [Op.in]: toBeIgnored } } }),
      ).to.have.length(toBeIgnored.length)
    })
  })

  describe('#getMatureRecycleRequests', () => {
    const now = moment().clone()
    const gracePeriodStart = now.clone().subtract(recycleGracePeriod, 'ms')

    const channelPhoneNumbers = {
      toRecycle: genPhoneNumber(),
      pending: genPhoneNumber(),
    }

    const recycleRequests = {
      toRecycle: {
        channelPhoneNumber: channelPhoneNumbers.toRecycle,
        // mature (created before start of grace period)
        createdAt: gracePeriodStart.clone().subtract(1, 'ms'),
      },
      pending: {
        channelPhoneNumber: channelPhoneNumbers.pending,
        // not mature (created after start of grace period)
        createdAt: gracePeriodStart.clone().add(1, 'ms'),
      },
    }

    beforeEach(async () => {
      sinon.stub(util, 'now').returns(now.clone())
      await Promise.all(
        values(recycleRequests).map(({ channelPhoneNumber }) =>
          app.db.channel.create(channelFactory({ phoneNumber: channelPhoneNumber })),
        ),
      )
      await Promise.all(
        values(recycleRequests).map(recycleRequest =>
          app.db.recycleRequest.create(recycleRequest).then(() =>
            app.db.sequelize.query(`
          update "recycleRequests"
            set "createdAt" = '${recycleRequest.createdAt.toISOString()}'
            where "channelPhoneNumber" = '${recycleRequest.channelPhoneNumber}';
          `),
          ),
        ),
      )
    })

    it('retrieves all mature recycle requests and returns their phone numbers', async () => {
      const res = await recycleRequestRepository.getMatureRecycleRequests(
        values(channelPhoneNumbers),
      )
      expect(res).to.eql([channelPhoneNumbers.toRecycle])
    })
  })
})
