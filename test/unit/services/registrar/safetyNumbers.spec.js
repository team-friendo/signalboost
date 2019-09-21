import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { expect } from 'chai'
import { trustAll, trustAllForMember } from '../../../../app/services/registrar/safetyNumbers'
import channelRepository from '../../../../app/db/repositories/channel'
import signal, { successMessages, errorMessages } from '../../../../app/services/signal'
const { trustSuccess } = successMessages
const { trustError } = errorMessages
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { channelFactory } from '../../../support/factories/channel'
import { times } from 'lodash'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { publicationFactory } from '../../../support/factories/publication'

describe('safety numbers registrar module', () => {
  let db = {}
  const sock = {}
  const channelNumbers = times(2, genPhoneNumber)
  const channels = [
    {
      ...channelFactory({
        phoneNumber: channelNumbers[0],
        subscriptions: times(2, () =>
          subscriptionFactory({ channelPhoneNumber: channelNumbers[0] }),
        ),
        publications: times(2, () => publicationFactory({ channelPhoneNumber: channelNumbers[0] })),
      }),
    },
    {
      ...channelFactory({
        phoneNumber: channelNumbers[1],
        subscriptions: times(2, () =>
          subscriptionFactory({ channelPhoneNumber: channelNumbers[1] }),
        ),
        publications: times(2, () => publicationFactory({ channelPhoneNumber: channelNumbers[1] })),
      }),
    },
  ]

  let findAllStub, findMembershipsStub, trustStub

  beforeEach(() => {
    findAllStub = sinon.stub(channelRepository, 'findAllDeep')
    findMembershipsStub = sinon.stub(channelRepository, 'findMembershipsByPhoneNumber')
    trustStub = sinon.stub(signal, 'trust')
  })

  afterEach(() => {
    findAllStub.restore()
    findMembershipsStub.restore()
    trustStub.restore()
  })

  describe('trusting all safety numbers', () => {
    it('attempts to retrieve all channels with their pub/subs', async () => {
      await trustAll(db, sock)
      expect(findAllStub.getCall(0).args).to.eql([db])
    })

    describe('when channels retrieval succeeds', () => {
      beforeEach(() => {
        findAllStub.returns(Promise.all(channels))
      })

      it('attempts to trust all safety numbers for all pub/subs', async () => {
        trustStub.returns(Promise.resolve())
        await trustAll(db, sock)
        expect(trustStub.callCount).to.eql(
          channels[0].publications.length +
            channels[0].subscriptions.length +
            channels[1].publications.length +
            channels[1].subscriptions.length,
        )
      })

      describe('when trust calls succeed', () => {
        beforeEach(() => {
          trustStub.callsFake((_, __, pubSubPhoneNumber) =>
            Promise.resolve({
              status: 'SUCCESS',
              message: successMessages.trustSuccess(pubSubPhoneNumber),
            }),
          )
        })

        it('returns a success object', async () => {
          expect(await trustAll(db, sock)).to.eql({ successes: 8, errors: 0 })
        })
      })

      describe('when a trust call fails', () => {
        beforeEach(() => {
          trustStub.callsFake((_, __, pubSubNumber) =>
            pubSubNumber === channels[0].subscriptions[1].subscriberPhoneNumber
              ? Promise.reject({ status: 'ERROR', message: trustError(pubSubNumber) })
              : Promise.resolve({ status: 'SUCCESS', message: trustSuccess(pubSubNumber) }),
          )
        })

        it('resolves with a trust tally denoting one error', async () => {
          expect(await trustAll(db, sock)).to.eql({ successes: 7, errors: 1 })
        })
      })
    })

    describe('when channel retrieval fails', () => {
      beforeEach(() => {
        findAllStub.callsFake(() => Promise.reject(new Error('db error')))
      })

      it('resolves with an error object', async () => {
        expect(await trustAll(db, sock)).to.eql({
          status: 'ERROR',
          message: 'db error',
        })
      })
    })
  })

  describe('trusting all safety numbers belonging to a given user', () => {
    const memberPhoneNumber = genPhoneNumber()

    it('attempts to retrieve all the users memberships', async () => {
      await trustAllForMember(db, sock, memberPhoneNumber)
      expect(findMembershipsStub.getCall(0).args).to.eql([db, memberPhoneNumber])
    })

    describe('when memberships retrieval succeeds', () => {
      beforeEach(() => {
        findMembershipsStub.returns(
          Promise.resolve({
            publications: [
              publicationFactory({
                channelPhoneNumber: channelNumbers[0],
                publisherPhoneNumber: memberPhoneNumber,
              }),
            ],
            subscriptions: [
              subscriptionFactory({
                channelPhoneNumber: channelNumbers[1],
                subscriberPhoneNumber: memberPhoneNumber,
              }),
            ],
          }),
        )
      })

      it('attempts to trust all safety numbers for all memberships', async () => {
        trustStub.returns(Promise.resolve())
        await trustAllForMember(db, sock, memberPhoneNumber)
        expect(trustStub.callCount).to.eql(2)
      })

      describe('when trust calls succeed', () => {
        beforeEach(() => {
          trustStub.callsFake((_, __, pubSubPhoneNumber) =>
            Promise.resolve({
              status: 'SUCCESS',
              message: successMessages.trustSuccess(pubSubPhoneNumber),
            }),
          )
        })

        it('returns a success object', async () => {
          expect(await trustAllForMember(db, sock, memberPhoneNumber)).to.eql({ successes: 2, errors: 0 })
        })
      })

      describe('when a trust call fails', () => {
        beforeEach(() => {
          trustStub.callsFake((_, __, pubSubNumber) =>
            pubSubNumber === channels[0].subscriptions[1].subscriberPhoneNumber
              ? Promise.reject({ status: 'ERROR', message: trustError(pubSubNumber) })
              : Promise.resolve({ status: 'SUCCESS', message: trustSuccess(pubSubNumber) }),
          )
        })

        it('resolves with a trust tally denoting one error', async () => {
          expect(await trustAll(db, sock)).to.eql({ successes: 7, errors: 1 })
        })
      })
    })

    describe('when channel retrieval fails', () => {
      beforeEach(() => {
        findAllStub.callsFake(() => Promise.reject(new Error('db error')))
      })

      it('resolves with an error object', async () => {
        expect(await trustAll(db, sock)).to.eql({
          status: 'ERROR',
          message: 'db error',
        })
      })
    })
  })
})
