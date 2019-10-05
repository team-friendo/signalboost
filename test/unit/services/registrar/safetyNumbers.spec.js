import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import { expect } from 'chai'
import { deauthorize, trustAndResend } from '../../../../app/services/registrar/safetyNumbers'
import signal from '../../../../app/services/signal'
import channelRepository from '../../../../app/db/repositories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { statuses } from '../../../../app/constants'
import { channelFactory } from '../../../support/factories/channel'
import { publicationFactory } from '../../../support/factories/publication'
import { messagesIn } from '../../../../app/services/dispatcher/messages'
import { defaultLanguage } from '../../../../app/config'
import { sdMessageOf } from '../../../../app/services/signal'
const {
  signal: { resendDelay },
} = require('../../../../app/config')

describe('safety numbers registrar module', () => {
  let db = {}
  const sock = {}
  const channelPhoneNumber = genPhoneNumber()
  const memberPhoneNumber = genPhoneNumber()
  const otherPublisherNumbers = [genPhoneNumber(), genPhoneNumber()]
  const sdMessage = sdMessageOf({ phoneNumber: channelPhoneNumber }, 'Good morning!')
  let trustStub, sendMessageStub, removePublisherStub, findDeepStub

  beforeEach(() => {
    trustStub = sinon.stub(signal, 'trust')
    sendMessageStub = sinon.stub(signal, 'sendMessage')
    removePublisherStub = sinon.stub(channelRepository, 'removePublisher')
    findDeepStub = sinon.stub(channelRepository, 'findDeep').returns(
      Promise.resolve(
        channelFactory({
          phoneNumber: channelPhoneNumber,
          publications: [
            publicationFactory({
              channelPhoneNumber,
              publisherPhoneNumber: otherPublisherNumbers[0],
            }),
            publicationFactory({
              channelPhoneNumber,
              publisherPhoneNumber: otherPublisherNumbers[1],
            }),
          ],
        }),
      ),
    )
  })

  afterEach(() => {
    trustStub.restore()
    sendMessageStub.restore()
    removePublisherStub.restore()
    findDeepStub.restore()
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

  describe('#deauthorize', () => {
    it('attempts to remove a publisher from a channel', async () => {
      await deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber).catch(a => a)
      expect(removePublisherStub.getCall(0).args).to.eql([
        db,
        channelPhoneNumber,
        memberPhoneNumber,
      ])
    })

    describe('if removal succeeds', () => {
      beforeEach(() =>
        removePublisherStub.returns(
          Promise.resolve({
            status: statuses.SUCCESS,
            message: 'fake removal success message',
          }),
        ),
      )

      it('notifies all the other publishers', async () => {
        await deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber).catch(a => a)
        expect(sendMessageStub.callCount).to.eql(2)
        expect(sendMessageStub.getCall(0).args).to.eql([
          db,
          otherPublisherNumbers[0],
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
        removePublisherStub.callsFake(() =>
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