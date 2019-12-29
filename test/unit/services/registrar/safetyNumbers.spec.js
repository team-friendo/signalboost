import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import { expect } from 'chai'
import { deauthorize, trustAndResend } from '../../../../app/services/registrar/safetyNumbers'
import signal from '../../../../app/services/signal'
import channelRepository from '../../../../app/db/repositories/channel'
import membershipRepository from '../../../../app/db/repositories/membership'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { statuses } from '../../../../app/constants'
import { channelFactory } from '../../../support/factories/channel'
import { messagesIn } from '../../../../app/services/dispatcher/strings/messages'
import { defaultLanguage } from '../../../../app/config'
import { sdMessageOf } from '../../../../app/services/signal'
import { adminMembershipFactory } from '../../../support/factories/membership'
const {
  signal: { resendDelay },
} = require('../../../../app/config')

describe('safety numbers registrar module', () => {
  let db = {}
  const sock = {}
  const channelPhoneNumber = genPhoneNumber()
  const memberPhoneNumber = genPhoneNumber()
  const otherAdminPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  const fingerprint =
    '05 45 8d 63 1c c4 14 55 bf 6d 24 9f ec cb af f5 8d e4 c8 d2 78 43 3c 74 8d 52 61 c4 4a e7 2c 3d 53 '
  const sdMessage = sdMessageOf({ phoneNumber: channelPhoneNumber }, 'Good morning!')
  const updatableFingerprint = { channelPhoneNumber, memberPhoneNumber, fingerprint, sdMessage }
  let trustStub, sendMessageStub, removeAdminStub, findDeepStub

  beforeEach(() => {
    trustStub = sinon.stub(signal, 'trust')
    sendMessageStub = sinon.stub(signal, 'sendMessage')
    removeAdminStub = sinon.stub(membershipRepository, 'removeAdmin')
    findDeepStub = sinon.stub(channelRepository, 'findDeep').returns(
      Promise.resolve(
        channelFactory({
          phoneNumber: channelPhoneNumber,
          memberships: [
            adminMembershipFactory({
              channelPhoneNumber,
              memberPhoneNumber: otherAdminPhoneNumbers[0],
            }),
            adminMembershipFactory({
              channelPhoneNumber,
              memberPhoneNumber: otherAdminPhoneNumbers[1],
            }),
          ],
        }),
      ),
    )
  })

  afterEach(() => {
    trustStub.restore()
    sendMessageStub.restore()
    removeAdminStub.restore()
    findDeepStub.restore()
  })

  describe('#trustAndResend', () => {
    it('attempts to trust the safety number between a member and a channel phone number', async () => {
      await trustAndResend(db, sock, updatableFingerprint).catch(a => a)
      expect(trustStub.getCall(0).args).to.eql([
        sock,
        channelPhoneNumber,
        memberPhoneNumber,
        fingerprint,
      ])
    })

    describe('when trust operation succeeds', () => {
      beforeEach(() =>
        trustStub.returns(
          Promise.resolve({ status: statuses.SUCCESS, message: 'fake trust success msg' }),
        ),
      )

      it('attempts to resend the original message after waiting some interval', async () => {
        const start = new Date().getTime()
        await trustAndResend(db, sock, updatableFingerprint).catch(a => a)
        const elapsed = new Date().getTime() - start

        expect(sendMessageStub.getCall(0).args).to.eql([sock, memberPhoneNumber, sdMessage])
        expect(elapsed).to.be.at.least(resendDelay)
      })

      describe('when resending the original message succeeds', () => {
        beforeEach(() => sendMessageStub.returns(Promise.resolve()))

        it('resolves with succes status', async () => {
          expect(await trustAndResend(db, sock, updatableFingerprint)).to.eql({
            status: statuses.SUCCESS,
            message: 'fake trust success msg',
          })
        })
      })

      describe('when resending fails', () => {
        beforeEach(() =>
          sendMessageStub.callsFake(() =>
            Promise.reject({
              status: statuses.ERROR,
              message: 'whoops',
            }),
          ),
        )

        it('rejects with error status', async () => {
          const err = await trustAndResend(db, sock, updatableFingerprint).catch(a => a)
          expect(err).to.eql({ status: statuses.ERROR, message: 'whoops' })
        })
      })
    })

    describe('when trust operation fails', () => {
      beforeEach(() =>
        trustStub.callsFake(() =>
          Promise.reject({
            status: statuses.ERROR,
            message: 'fake trust error message',
          }),
        ),
      )
      it('rejects with error status', async () => {
        const err = await trustAndResend(
          db,
          sock,
          channelPhoneNumber,
          memberPhoneNumber,
          sdMessage,
        ).catch(a => a)

        expect(err).to.eql({ status: statuses.ERROR, message: 'fake trust error message' })
      })
    })
  })

  describe('#deauthorize', () => {
    it('attempts to remove a admin from a channel', async () => {
      await deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber).catch(a => a)
      expect(removeAdminStub.getCall(0).args).to.eql([db, channelPhoneNumber, memberPhoneNumber])
    })

    describe('if removal succeeds', () => {
      beforeEach(() =>
        removeAdminStub.returns(
          Promise.resolve({
            status: statuses.SUCCESS,
            message: 'fake removal success message',
          }),
        ),
      )

      it('notifies all the other admins', async () => {
        await deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber).catch(a => a)
        expect(sendMessageStub.callCount).to.eql(2)
        expect(sendMessageStub.getCall(0).args).to.eql([
          db,
          otherAdminPhoneNumbers[0],
          sdMessageOf(
            { phoneNumber: channelPhoneNumber },
            messagesIn(defaultLanguage).notifications.deauthorization(memberPhoneNumber),
          ),
        ])
      })

      describe('if notification succeeds', () => {
        beforeEach(() => sendMessageStub.returns(Promise.resolve()))

        it('resolves with a success status', async () => {
          const res = await deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber)
          expect(res).to.eql({ status: statuses.SUCCESS, message: 'fake removal success message' })
        })
      })

      describe('if notification fails', () => {
        beforeEach(() =>
          sendMessageStub.callsFake(() =>
            Promise.reject({
              status: statuses.ERROR,
              error: 'write failure',
            }),
          ),
        )

        it('rejects with an error', async () => {
          const err = await deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber).catch(
            a => a,
          )
          expect(err).to.eql({
            status: statuses.ERROR,
            error: 'write failure',
          })
        })
      })
    })

    describe('if removal fails', () => {
      beforeEach(() =>
        removeAdminStub.callsFake(() =>
          Promise.reject({
            status: statuses.ERROR,
            message: 'fake removal error message',
          }),
        ),
      )

      it('rejects with an error', async () => {
        const err = await deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber).catch(a => a)
        expect(err).to.eql({
          status: statuses.ERROR,
          message: 'fake removal error message',
        })
      })
    })
  })
})
