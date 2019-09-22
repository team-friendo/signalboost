import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { expect } from 'chai'
import { trust, trustAndResend } from '../../../../app/services/registrar/safetyNumbers'
import channelRepository from '../../../../app/db/repositories/channel'
import signal from '../../../../app/services/signal'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { times } from 'lodash'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { publicationFactory } from '../../../support/factories/publication'
import { sdMessageOf } from '../../../../app/services/dispatcher/messenger'
import { statuses } from '../../../../app/constants'
const {
  signal: { resendDelay },
} = require('../../../../app/config')

describe('safety numbers registrar module', () => {
  let db = {}
  const sock = {}
  const channelNumbers = times(2, genPhoneNumber)
  const memberPhoneNumber = genPhoneNumber()
  const memberships = {
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
  }
  let findMembershipsStub, trustStub, sendMessageStub

  beforeEach(() => {
    findMembershipsStub = sinon.stub(channelRepository, 'findMemberships')
    trustStub = sinon.stub(signal, 'trust')
    sendMessageStub = sinon.stub(signal, 'sendMessage')
  })

  afterEach(() => {
    findMembershipsStub.restore()
    trustStub.restore()
    sendMessageStub.restore()
  })

  describe('#trust (trusting all safety numbers belonging to a given user)', () => {
    it('attempts to retrieve all the users memberships', async () => {
      await trust(db, sock, memberPhoneNumber)
      expect(findMembershipsStub.getCall(0).args).to.eql([db, memberPhoneNumber])
    })

    describe('when memberships retrieval succeeds', () => {
      beforeEach(() => findMembershipsStub.returns(Promise.resolve(memberships)))

      it('attempts to trust all safety numbers for all memberships', async () => {
        trustStub.returns(Promise.resolve())
        await trust(db, sock, memberPhoneNumber)

        expect(trustStub.callCount).to.eql(2)
        expect(trustStub.getCall(0).args).to.eql([sock, channelNumbers[0], memberPhoneNumber])
        expect(trustStub.getCall(1).args).to.eql([sock, channelNumbers[1], memberPhoneNumber])
      })

      describe('when trust calls succeed', () => {
        beforeEach(() =>
          trustStub.returns(
            Promise.resolve({
              status: statuses.SUCCESS,
              message: 'fake trust success message',
            }),
          ),
        )

        it('returns a success tally', async () => {
          expect(await trust(db, sock, memberPhoneNumber)).to.eql({
            successes: 2,
            errors: 0,
            noops: 0,
          })
        })
      })

      describe('when a trust call fails', () => {
        beforeEach(() => {
          trustStub.onCall(0).callsFake(() =>
            Promise.reject({
              status: statuses.ERROR,
              message: 'fake trust error message',
            }),
          )
          trustStub.onCall(1).returns(
            Promise.resolve({
              status: statuses.SUCCESS,
              message: 'fake trust success message',
            }),
          )
        })

        it('resolves with a trust tally denoting one error', async () => {
          expect(await trust(db, sock, memberPhoneNumber)).to.eql({
            successes: 1,
            errors: 1,
            noops: 0,
          })
        })
      })
    })

    describe('when channel retrieval fails', () => {
      beforeEach(() => {
        findMembershipsStub.callsFake(() => Promise.reject(new Error('db error')))
      })

      it('registers failure in the trust tally', async () => {
        expect(await trust(db, sock, memberPhoneNumber)).to.eql({
          successes: 0,
          errors: 1,
          noops: 0,
        })
      })
    })
  })

  describe("#trustAndResend (trusting a user's safety numbers then resending them a message)", () => {
    const sdMessage = sdMessageOf({ phoneNumber: channelNumbers[0] }, 'foo')

    describe('in all cases', () => {
      beforeEach(() => findMembershipsStub.returns(Promise.resolve(memberships)))

      it("attempts to retrust all of a user's safety numbers", async () => {
        await trustAndResend(db, sock, memberPhoneNumber, sdMessage)

        expect(findMembershipsStub.callCount).to.eql(1)
        expect(trustStub.getCall(0).args).to.eql([sock, channelNumbers[0], memberPhoneNumber])
      })
    })

    describe('when trust commands succeed', () => {
      beforeEach(() => {
        findMembershipsStub.returns(memberships)
        trustStub.returns(
          Promise.resolve({
            status: statuses.SUCCESS,
            message: 'foo',
          }),
        )
        sendMessageStub.onCall(0).returns(Promise.resolve()) // notification for publisher membership
        sendMessageStub.onCall(1).returns(Promise.resolve()) // notification for subscriber membership
      })

      it('waits for an interval then resends the original message', async () => {
        const start = new Date().getTime()
        await trustAndResend(db, sock, memberPhoneNumber)

        expect(sendMessageStub.callCount).to.eql(3) // 2 for notifications, 1 for resend
        expect(sendMessageStub.getCall(2).args[1]).to.eql(memberPhoneNumber)
        expect(new Date().getTime() - start).to.be.at.least(resendDelay)
      })

      describe('when resending succeeds', () => {
        beforeEach(() => sendMessageStub.onCall(2).returns(Promise.resolve()))

        it('returns a success tally', async () => {
          expect(await trustAndResend(db, sock, memberPhoneNumber)).to.eql({
            successes: 2,
            errors: 0,
            noops: 0,
          })
        })
      })

      describe('when resending fails', () => {
        beforeEach(() =>
          sendMessageStub.onCall(2).callsFake(() => Promise.reject(new Error('oh noes!'))),
        )

        it('returns an error status', async () => {
          expect(await trustAndResend(db, sock, memberPhoneNumber)).to.eql({
            status: statuses.ERROR,
            message: 'oh noes!',
          })
        })
      })
    })

    describe('when a trust command fails', () => {
      beforeEach(() => {
        findMembershipsStub.returns(memberships)
        trustStub.callsFake(() =>
          Promise.reject({
            status: statuses.ERROR,
            message: 'fake error',
          }),
        )
      })

      it('returns an error status', async () => {
        expect(await trustAndResend(db, sock, memberPhoneNumber)).to.eql({
          successes: 0,
          noops: 0,
          errors: 2,
        })
      })

      describe('when a trust notification fails', () => {
        beforeEach(() => {
          findMembershipsStub.returns(memberships)
          trustStub.returns(Promise.resolve({ status: statuses.SUCCESS, message: 'foo'}))
          sendMessageStub.onCall(0).callsFake(() => Promise.reject(new Error('oh noes!')))
        })

        it('includes the error in a tally', async () => {
          expect(await trustAndResend(db, sock, memberPhoneNumber)).to.eql({
            successes: 1,
            errors: 1,
            noops: 0,
          })
        })
      })
    })
  })
})
