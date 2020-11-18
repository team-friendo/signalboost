import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import moment from 'moment'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import dbService from '../../../../app/db'
import destructionRequestRepository from '../../../../app/db/repositories/destructionRequest'
import util from '../../../../app/util'
import { times, values, map, get } from 'lodash'
import { channelFactory, deepChannelFactory } from '../../../support/factories/channel'
import { Op } from 'sequelize'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../../../support/factories/membership'
import { destructionRequestFactory } from '../../../support/factories/destructionRequest'

const {
  jobs: { channelDestructionGracePeriod },
} = require('../../../../app/config')

describe('destructionRequest repository', () => {
  const channelPhoneNumber = genPhoneNumber()
  let db, destructionRequestCount

  const createDestructionRequestsFromAttrs = async destructionRequests => {
    await Promise.all(
      values(destructionRequests).map(({ channelPhoneNumber, channel }) =>
        app.db.channel.create(
          channelFactory({
            phoneNumber: channelPhoneNumber,
            memberships: get(channel, 'memberships', []),
          }),
          {
            include: [{ model: app.db.membership }],
          },
        ),
      ),
    )
    await Promise.all(
      values(destructionRequests).map(destructionRequest =>
        app.db.destructionRequest.create(destructionRequest).then(() =>
          app.db.sequelize.query(`
          update "destructionRequests"
            set "createdAt" = '${destructionRequest.createdAt.toISOString()}'
            where "channelPhoneNumber" = '${destructionRequest.channelPhoneNumber}';
          `),
        ),
      ),
    )
  }

  before(async () => (db = (await app.run({ ...testApp, db: dbService })).db))
  beforeEach(async () => {
    await db.channel.create(channelFactory({ phoneNumber: channelPhoneNumber }))
  })
  afterEach(async () => {
    await app.db.destructionRequest.destroy({ where: {} })
    await app.db.messageCount.destroy({ where: {} })
    await app.db.channel.destroy({ where: {} })
    sinon.restore()
  })
  after(async () => await app.stop())

  describe('#requestToDestroy', () => {
    describe('if destruction request does not yet exist for given channel phone number', () => {
      beforeEach(async () => (destructionRequestCount = await db.destructionRequest.count()))

      it('creates new request and flags that it was created', async () => {
        const { destructionRequest, wasCreated } = await destructionRequestRepository.findOrCreate(
          channelPhoneNumber,
        )
        expect(wasCreated).to.eql(true)
        expect(destructionRequest.channelPhoneNumber).to.eql(channelPhoneNumber)
        expect(await app.db.destructionRequest.count()).to.eql(destructionRequestCount + 1)
      })
    })

    describe('if destruction request already exists for given channel phone number', () => {
      beforeEach(async () => {
        await app.db.destructionRequest.create({ channelPhoneNumber })
        destructionRequestCount = await db.destructionRequest.count()
      })

      it('does not create new request but returns existing request', async () => {
        const { destructionRequest, wasCreated } = await destructionRequestRepository.findOrCreate(
          channelPhoneNumber,
        )
        expect(wasCreated).to.eql(false)
        expect(destructionRequest.channelPhoneNumber).to.eql(channelPhoneNumber)
        expect(await app.db.destructionRequest.count()).to.eql(destructionRequestCount)
      })
    })
  })

  describe('#destroy', () => {
    beforeEach(async () => {
      await app.db.destructionRequest.create({ channelPhoneNumber })
      destructionRequestCount = await db.destructionRequest.count()
    })

    describe('when given the phone number of an existing destruction request', () => {
      it('destroys the destruction request', async () => {
        expect(await destructionRequestRepository.destroy(channelPhoneNumber)).to.eql(1)
        expect(await db.destructionRequest.count()).to.eql(destructionRequestCount - 1)
        expect(await db.destructionRequest.findOne({ where: { channelPhoneNumber } })).to.be.null
      })
    })
    describe('when given a random phone number', () => {
      it('does nothing', async () => {
        expect(await destructionRequestRepository.destroy(genPhoneNumber())).to.eql(0)
        expect(await db.destructionRequest.count()).to.eql(destructionRequestCount)
        expect(await db.destructionRequest.findOne({ where: { channelPhoneNumber } })).not.to.be
          .null
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
        allNumbers.map(channelPhoneNumber => db.destructionRequest.create({ channelPhoneNumber })),
      )
      destructionRequestCount = await db.destructionRequest.count()
    })
    it('deletes all destruction requests with phone numbers in a given list', async () => {
      expect(await destructionRequestRepository.destroyMany(toBeDeleted)).to.eql(toBeDeleted.length)
      expect(await db.destructionRequest.count()).to.eql(
        destructionRequestCount - toBeDeleted.length,
      )
      expect(
        await db.destructionRequest.findAll({
          where: { channelPhoneNumber: { [Op.in]: toBeDeleted } },
        }),
      ).to.have.length(0)
      expect(
        await db.destructionRequest.findAll({
          where: { channelPhoneNumber: { [Op.in]: toBeIgnored } },
        }),
      ).to.have.length(toBeIgnored.length)
    })
  })

  describe('#getNotifiableDestructionRequests', () => {
    const now = moment().clone()
    const gracePeriodStart = now.clone().subtract(channelDestructionGracePeriod, 'ms')
    const duringGracePeriod = gracePeriodStart.clone().add(1000, 'ms')
    const notificationThreshold = now.clone().subtract(channelDestructionGracePeriod / 3, 'ms')
    const beforeNotificationThreshold = notificationThreshold.clone().subtract(1000, 'ms')
    const afterNotificationThreshold = notificationThreshold.clone().add(1000, 'ms')

    const destructionRequestAttrs = {
      pendingDontNotify: {
        channelPhoneNumber: genPhoneNumber(),
        createdAt: duringGracePeriod,
        lastNotifiedAt: afterNotificationThreshold,
      },
      pendingDoNotify: {
        channelPhoneNumber: genPhoneNumber(),
        createdAt: duringGracePeriod,
        lastNotifiedAt: notificationThreshold,
        channel: deepChannelFactory({
          memberships: [...times(2, adminMembershipFactory), subscriberMembershipFactory()],
        }),
      },
      pendingDoNotifyAlso: {
        channelPhoneNumber: genPhoneNumber(),
        createdAt: duringGracePeriod,
        lastNotifiedAt: beforeNotificationThreshold,
        channel: deepChannelFactory({
          memberships: [...times(3, adminMembershipFactory), subscriberMembershipFactory()],
        }),
      },
      mature: {
        channelPhoneNumber: genPhoneNumber(),
        createdAt: gracePeriodStart,
        lastNotifiedAt: notificationThreshold,
      },
    }
    const { pendingDoNotify, pendingDoNotifyAlso } = destructionRequestAttrs

    beforeEach(async () => {
      sinon.stub(util, 'now').returns(now.clone())
      await createDestructionRequestsFromAttrs(destructionRequestAttrs)
    })

    it('returns all channels with pending destruction requests not recently notified', async () => {
      const requests = await destructionRequestRepository.getNotifiableDestructionRequests()
      expect(map(requests, 'channelPhoneNumber')).to.have.members([
        pendingDoNotify.channelPhoneNumber,
        pendingDoNotifyAlso.channelPhoneNumber,
      ])
      // assert we only included admin memberships in returned requests
      expect(map(requests, r => r.channel.memberships.length)).to.have.deep.members([2, 3])
    })
  })

  describe('#recordNotifications', () => {
    const channelPhoneNumbers = times(3, genPhoneNumber)
    beforeEach(async () => {
      await Promise.all(
        channelPhoneNumbers.map(phoneNumber =>
          app.db.channel.create(channelFactory({ phoneNumber })),
        ),
      )
      await Promise.all(
        channelPhoneNumbers.map(channelPhoneNumber =>
          app.db.destructionRequest.create(destructionRequestFactory({ channelPhoneNumber })),
        ),
      )
    })
    it('updates the lastNotifiedAt field on a batch of destruction requests', async () => {
      const timestamp = util.nowTimestamp()
      await destructionRequestRepository.recordNotifications(timestamp, channelPhoneNumbers)
      const updatedRequests = await app.db.destructionRequest.findAll({
        where: { channelPhoneNumber: { [Op.in]: channelPhoneNumbers } },
      })
      expect(updatedRequests.map(r => r.lastNotifiedAt.toISOString())).to.eql([
        timestamp,
        timestamp,
        timestamp,
      ])
    })
  })

  describe('#getMatureDestructionRequests', () => {
    const now = moment().clone()
    const gracePeriodStart = now.clone().subtract(channelDestructionGracePeriod, 'ms')

    const channelPhoneNumbers = {
      toDestroy: genPhoneNumber(),
      pending: genPhoneNumber(),
    }

    const destructionRequestAttrs = {
      toDestroy: {
        channelPhoneNumber: channelPhoneNumbers.toDestroy,
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
      await createDestructionRequestsFromAttrs(destructionRequestAttrs)
    })

    it('retrieves all mature destruction requests and returns their phone numbers', async () => {
      const res = await destructionRequestRepository.getMatureDestructionRequests()
      expect(map(res, 'channelPhoneNumber')).to.eql([channelPhoneNumbers.toDestroy])
    })
  })
})
