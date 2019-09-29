import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import { expect } from 'chai'
import { trustAndResend } from '../../../../app/services/registrar/safetyNumbers'
import signal from '../../../../app/services/signal'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { sdMessageOf } from '../../../../app/services/dispatcher/messenger'
import { statuses } from '../../../../app/constants'
const {
  signal: { resendDelay },
} = require('../../../../app/config')

describe('safety numbers registrar module', () => {
  let db = {}
  const sock = {}
  const channelPhoneNumber = genPhoneNumber()
  const memberPhoneNumber = genPhoneNumber()
  const sdMessage = sdMessageOf({ phoneNumber: channelPhoneNumber }, 'Good morning!')
  let trustStub, sendMessageStub, logSpy, logErrorSpy

  beforeEach(() => {
    trustStub = sinon.stub(signal, 'trust')
    sendMessageStub = sinon.stub(signal, 'sendMessage')
  })

  afterEach(() => {
    trustStub.restore()
    sendMessageStub.restore()
  })

  describe('#trustAndResend', () => {
    it('attempts to trust the safety number between a member and a channel phone number', async () => {
      await trustAndResend(db, sock, channelPhoneNumber, memberPhoneNumber, sdMessage).catch(a => a)
      expect(trustStub.getCall(0).args).to.eql([sock, channelPhoneNumber, memberPhoneNumber])
    })

    describe('when trust operation succeeds', () => {
      beforeEach(() =>
        trustStub.returns(
          Promise.resolve({ status: statuses.SUCCESS, message: 'fake trust success msg' }),
        ),
      )

      it('attempts to resend the original message after waiting some interval', async () => {
        const start = new Date().getTime()
        await trustAndResend(db, sock, channelPhoneNumber, memberPhoneNumber, sdMessage).catch(
          a => a,
        )
        const elapsed = new Date().getTime() - start

        expect(sendMessageStub.getCall(0).args).to.eql([sock, memberPhoneNumber, sdMessage])
        expect(elapsed).to.be.at.least(resendDelay)
      })

      describe('when resending the original message succeeds', () => {
        beforeEach(() => sendMessageStub.returns(Promise.resolve()))

        it('resolves with succes status', async () => {
          expect(
            await trustAndResend(db, sock, channelPhoneNumber, memberPhoneNumber, sdMessage),
          ).to.eql({
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
          const err = await trustAndResend(
            db,
            sock,
            channelPhoneNumber,
            memberPhoneNumber,
            sdMessage,
          ).catch(a => a)

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
})
