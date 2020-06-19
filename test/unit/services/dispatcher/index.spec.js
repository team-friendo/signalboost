import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times, merge } from 'lodash'
import { EventEmitter } from 'events'
import { languages } from '../../../../app/services/language'
import { memberTypes } from '../../../../app/db/repositories/membership'
import { run } from '../../../../app/services/dispatcher'
import channelRepository, { getAllAdminsExcept } from '../../../../app/db/repositories/channel'
import membershipRepository from '../../../../app/db/repositories/membership'
import signal, { messageTypes, sdMessageOf } from '../../../../app/services/signal'
import executor from '../../../../app/services/dispatcher/commands'
import messenger from '../../../../app/services/dispatcher/messenger'
import registrar from '../../../../app/services/registrar'
import resend from '../../../../app/services/dispatcher/resend'
import safetyNumberService from '../../../../app/services/registrar/safetyNumbers'
import logger from '../../../../app/services/dispatcher/logger'
import { deepChannelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { wait } from '../../../../app/services/util'
import { messagesIn } from '../../../../app/services/dispatcher/strings/messages'
import { adminMembershipFactory } from '../../../support/factories/membership'
import { inboundAttachmentFactory } from '../../../support/factories/sdMessage'
import app from '../../../../app'
import dbService from '../../../../app/db'
import socketService from '../../../../app/services/socket'
const {
  signal: { defaultMessageExpiryTime, supportPhoneNumber, minResendInterval },
} = require('../../../../app/config')

describe('dispatcher service', () => {
  const channels = times(2, deepChannelFactory)
  const channel = channels[0]
  const adminPhoneNumber = channels[0].memberships[0].memberPhoneNumber
  const subscriberPhoneNumber = channels[0].memberships[2].memberPhoneNumber
  const randoPhoneNumber = genPhoneNumber()
  const sender = {
    phoneNumber: adminPhoneNumber,
    language: languages.EN,
    type: memberTypes.ADMIN,
  }
  const sdInMessage = {
    type: messageTypes.MESSAGE,
    data: {
      username: channel.phoneNumber,
      source: adminPhoneNumber,
      dataMessage: {
        timestamp: new Date().getTime(),
        message: 'foo',
        expiresInSeconds: defaultMessageExpiryTime,
        attachments: [],
      },
    },
  }
  const sdOutMessage = signal.parseOutboundSdMessage(sdInMessage)
  const socketDelay = 5

  let findDeepStub,
    resolveMemberTypeStub,
    trustAndResendStub,
    deauthorizeStub,
    processCommandStub,
    dispatchStub,
    logAndReturnSpy,
    logErrorSpy,
    sendMessageStub,
    enqueueResendStub

  beforeEach(async () => {
    // initialization stubs --v

    sinon.stub(channelRepository, 'findAllDeep').returns(Promise.resolve(channels))
    sinon.stub(signal, 'subscribe').returns(Promise.resolve())

    // main loop stubs --^

    // on inboundMessage stubs --v

    findDeepStub = sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channels[0]))

    resolveMemberTypeStub = sinon
      .stub(membershipRepository, 'resolveMemberType')
      .returns(Promise.resolve(memberTypes.ADMIN))

    sinon.stub(membershipRepository, 'resolveSenderLanguage').returns(languages.EN)

    trustAndResendStub = sinon
      .stub(safetyNumberService, 'trustAndResend')
      .returns(Promise.resolve({ status: 'SUCCESS', message: 'fake trust success' }))

    deauthorizeStub = sinon
      .stub(safetyNumberService, 'deauthorize')
      .returns(Promise.resolve({ status: 'SUCCESS', message: 'fake deauthorize success' }))

    processCommandStub = sinon
      .stub(executor, 'processCommand')
      .returns(Promise.resolve({ command: 'NOOP', status: 'SUCCESS', message: 'foo' }))

    dispatchStub = sinon.stub(messenger, 'dispatch').returns(Promise.resolve())

    sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve())

    enqueueResendStub = sinon.stub(resend, 'enqueueResend')

    logAndReturnSpy = sinon.spy(logger, 'logAndReturn')
    logErrorSpy = sinon.spy(logger, 'error')
    // onReceivedMessage stubs --^

    // app module stubs --v
    sinon.stub(registrar, 'run').returns(Promise.resolve())
    sinon.stub(dbService, 'initDb').returns(Promise.resolve({}))
    sinon
      .stub(socketService, 'getSocket')
      .returns(Promise.resolve(new EventEmitter().setMaxListeners(30)))

    await app.run()
    await run()
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('handling an incoming message', () => {
    describe('deciding whether to dispatch a message', () => {
      describe('when message is not of type "message"', () => {
        beforeEach(async () => {
          app.sock.emit(
            'data',
            JSON.stringify({
              type: 'list_groups',
              data: {
                username: '+12223334444',
              },
            }),
          )
          await wait(socketDelay)
        })

        it('ignores the message', () => {
          expect(processCommandStub.callCount).to.eql(0)
          expect(dispatchStub.callCount).to.eql(0)
        })
      })

      describe('when message is of type "message"', () => {
        describe('when message has a body', () => {
          beforeEach(async () => {
            app.sock.emit(
              'data',
              JSON.stringify({
                type: 'message',
                data: {
                  dataMessage: {
                    message: 'hi',
                    attachments: [],
                  },
                },
              }),
            )
            await wait(socketDelay)
          })

          it('dispatches the message', () => {
            expect(processCommandStub.callCount).to.be.above(0)
            expect(dispatchStub.callCount).to.be.above(0)
          })
        })

        describe('when message lacks a body but contains an attachment', () => {
          beforeEach(async () => {
            app.sock.emit(
              'data',
              JSON.stringify({
                type: 'message',
                data: {
                  dataMessage: {
                    message: '',
                    attachments: ['cool pix!'],
                  },
                },
              }),
            )
            await wait(socketDelay)
          })

          it('dispatches the message', () => {
            expect(processCommandStub.callCount).to.be.above(0)
            expect(dispatchStub.callCount).to.be.above(0)
          })
        })

        describe('when message lacks a body AND an attachment', () => {
          beforeEach(async () => {
            app.sock.emit(
              'data',
              JSON.stringify({ type: 'message', data: { receipt: { type: 'READ' } } }),
            )
            await wait(socketDelay)
          })

          it('ignores the message', () => {
            expect(processCommandStub.callCount).to.eql(0)
            expect(dispatchStub.callCount).to.eql(0)
          })
        })
      })
    })

    describe('when message lacks a body AND an attachment', () => {
      beforeEach(async () => {
        app.sock.emit(
          'data',
          JSON.stringify({ type: 'message', data: { receipt: { type: 'READ' } } }),
        )
        await wait(socketDelay)
      })

      it('ignores the message', () => {
        expect(processCommandStub.callCount).to.eql(0)
        expect(dispatchStub.callCount).to.eql(0)
      })
    })

    describe('dispatching a message', () => {
      beforeEach(async () => {
        app.sock.emit('data', JSON.stringify(sdInMessage))
        await wait(socketDelay)
      })

      it('retrieves a channel record', () => {
        expect(findDeepStub.getCall(0).args).to.eql([app.db, channel.phoneNumber])
      })

      it('retrieves permissions for the message sender', () => {
        expect(resolveMemberTypeStub.getCall(0).args).to.eql([
          app.db,
          channel.phoneNumber,
          adminPhoneNumber,
        ])
      })

      it('processes any commands in the message', () => {
        expect(processCommandStub.getCall(0).args[0]).to.eql({
          db: app.db,
          sock: app.sock,
          channel,
          sender,
          sdMessage: sdOutMessage,
        })
      })

      it('passes the command result and original message to messenger for dispatch', () => {
        expect(dispatchStub.getCall(0).args[0]).to.eql({
          commandResult: { command: 'NOOP', status: 'SUCCESS', message: 'foo' },
          dispatchable: {
            db: app.db,
            sock: app.sock,
            channel,
            sender,
            sdMessage: sdOutMessage,
          },
        })
      })
    })

    describe('and the recipient is a random person (why would this ever happen?)', () => {
      beforeEach(async () => resolveMemberTypeStub.returns(memberTypes.NONE))

      it('drops the message', async () => {
        app.sock.emit('data', JSON.stringify(sdInMessage))
        await wait(socketDelay)

        expect(trustAndResendStub.callCount).to.eql(0) // does not attempt to resend
        expect(deauthorizeStub.callCount).to.eql(0) // does not attempt to deauth
      })
    })

    describe('when message is a rate limit error notification', () => {
      const supportChannel = deepChannelFactory({
        phoneNumber: supportPhoneNumber,
        memberships: ['EN', 'ES', 'FR'].map(language =>
          adminMembershipFactory({ channelPhoneNumber: supportPhoneNumber, language }),
        ),
      })
      const recipientNumber = genPhoneNumber()
      const messageBody = '[foo]\nbar'
      const originalSdMessage = {
        type: 'send',
        username: channel.phoneNumber,
        messageBody,
        recipientNumber,
        attachments: [],
        expiresInSeconds: 0,
      }
      const sdErrorMessage = {
        type: signal.messageTypes.ERROR,
        data: {
          msg_number: 0,
          error: true,
          message: 'Rate limit exceeded: 413',
          username: channel.phoneNumber,
          request: originalSdMessage,
        },
      }

      beforeEach(() => enqueueResendStub.returns(minResendInterval))

      describe('and there is a support channel', () => {
        beforeEach(async () => {
          findDeepStub.returns(Promise.resolve(supportChannel))
          app.sock.emit('data', JSON.stringify(sdErrorMessage))
          await wait(2 * socketDelay)
        })

        it('enqueues the message for resending', () => {
          expect(enqueueResendStub.getCall(0).args).to.eql([app.sock, {}, originalSdMessage])
        })

        it('notifies admins of the support channel', () => {
          supportChannel.memberships.forEach(({ memberPhoneNumber, language }, idx) =>
            expect(sendMessageStub.getCall(idx).args).to.eql([
              app.sock,
              memberPhoneNumber,
              sdMessageOf(
                { phoneNumber: supportPhoneNumber },
                messagesIn(language).notifications.rateLimitOccurred(
                  channel.phoneNumber,
                  minResendInterval,
                ),
              ),
            ]),
          )
        })
      })

      describe('and there is not a support channel', () => {
        beforeEach(async () => {
          findDeepStub.returns(Promise.resolve(null))
          app.sock.emit('data', JSON.stringify(sdErrorMessage))
          await wait(2 * socketDelay)
        })

        it('enqueues the message for resending', () => {
          expect(enqueueResendStub.getCall(0).args).to.eql([app.sock, {}, originalSdMessage])
        })

        it('does not send any notifications', () => {
          expect(sendMessageStub.callCount).to.eql(0)
        })
      })
    })

    describe('when message is an untrusted identity error notification', () => {
      const recipientNumber = genPhoneNumber()
      const messageBody = '[foo]\nbar'
      const inboundAttachment = inboundAttachmentFactory()
      const originalSdMessage = {
        type: 'send',
        username: channel.phoneNumber,
        messageBody,
        recipientNumber,
        attachments: [inboundAttachment],
        expiresInSeconds: 0,
      }
      const fingerprint =
        '05 45 8d 63 1c c4 14 55 bf 6d 24 9f ec cb af f5 8d e4 c8 d2 78 43 3c 74 8d 52 61 c4 4a e7 2c 3d 53 '
      const sdErrorMessage = {
        type: signal.messageTypes.UNTRUSTED_IDENTITY,
        data: {
          username: channel.phoneNumber,
          number: recipientNumber,
          fingerprint,
          safety_number: '074940190139780110760016007890517723684588610476310913703803',
          request: originalSdMessage,
        },
      }

      describe('when intended recipient is a subscriber', () => {
        beforeEach(async () => resolveMemberTypeStub.returns(memberTypes.SUBSCRIBER))

        it("attempts to trust the recipient's safety number and re-send the message", async () => {
          app.sock.emit('data', JSON.stringify(sdErrorMessage))
          await wait(socketDelay)

          expect(deauthorizeStub.callCount).to.eql(0) // does not attempt to deauthorize user
          expect(trustAndResendStub.getCall(0).args).to.eql([
            app.db,
            app.sock,
            {
              channelPhoneNumber: channel.phoneNumber,
              memberPhoneNumber: recipientNumber,
              fingerprint,
              sdMessage: signal.parseOutboundSdMessage(originalSdMessage),
            },
          ])
        })

        describe('when trusting succeeds', () => {
          // this is the default stub
          it('logs the success', async () => {
            app.sock.emit('data', JSON.stringify(sdErrorMessage))
            await wait(socketDelay)

            expect(logAndReturnSpy.getCall(0).args).to.eql([
              {
                status: 'SUCCESS',
                message: 'fake trust success',
              },
            ])
          })
        })

        describe('when trusting fails', () => {
          const errorStatus = { status: 'ERROR', message: 'fake trust error' }
          beforeEach(() => trustAndResendStub.callsFake(() => Promise.reject(errorStatus)))

          it('logs the failure', async () => {
            app.sock.emit('data', JSON.stringify(sdErrorMessage))
            await wait(socketDelay)

            expect(logErrorSpy.getCall(0).args).to.eql([errorStatus])
          })
        })
      })

      describe('when intended recipient is an admin', () => {
        beforeEach(async () => resolveMemberTypeStub.returns(memberTypes.ADMIN))

        it('attempts to deauthorize the admin', async () => {
          app.sock.emit('data', JSON.stringify(sdErrorMessage))
          await wait(socketDelay)

          expect(trustAndResendStub.callCount).to.eql(0) // does not attempt to resend
          expect(deauthorizeStub.getCall(0).args[2]).to.eql({
            channelPhoneNumber: channel.phoneNumber,
            memberPhoneNumber: recipientNumber,
            fingerprint,
            sdMessage: signal.parseOutboundSdMessage(originalSdMessage),
          })
        })

        describe('when deauth succeeds', () => {
          // this is the default stub
          it('logs the success', async () => {
            app.sock.emit('data', JSON.stringify(sdErrorMessage))
            await wait(socketDelay)

            expect(logAndReturnSpy.getCall(0).args).to.eql([
              {
                status: 'SUCCESS',
                message: 'fake deauthorize success',
              },
            ])
          })
        })

        describe('when deauth fails', () => {
          const errorStatus = { status: 'ERROR', message: 'fake deauthorize error' }
          beforeEach(() => deauthorizeStub.callsFake(() => Promise.reject(errorStatus)))

          it('logs the failure', async () => {
            app.sock.emit('data', JSON.stringify(sdErrorMessage))
            await wait(socketDelay)

            expect(logErrorSpy.getCall(0).args).to.eql([errorStatus])
          })
        })
      })
    })

    describe('expiry time updates', () => {
      const expiryUpdate = merge({}, sdInMessage, {
        data: {
          dataMessage: {
            expiresInSeconds: 60,
            messageBody: '',
          },
        },
      })

      let updateStub, setExpirationStub
      beforeEach(() => {
        updateStub = sinon.stub(channelRepository, 'update')
        setExpirationStub = sinon.stub(signal, 'setExpiration')
      })
      afterEach(() => {
        updateStub.restore()
        setExpirationStub.restore()
      })

      describe('from an admin', () => {
        beforeEach(async () => {
          app.sock.emit('data', JSON.stringify(expiryUpdate))
          await wait(socketDelay)
        })

        it('stores the new expiry time', () => {
          expect(updateStub.getCall(0).args).to.eql([
            app.db,
            channel.phoneNumber,
            { messageExpiryTime: 60 },
          ])
        })

        it('updates the expiry time between the channel and every other channel member', () => {
          getAllAdminsExcept(channel, [adminPhoneNumber]).forEach((membership, i) =>
            expect(setExpirationStub.getCall(i).args).to.eql([
              app.sock,
              channel.phoneNumber,
              membership.memberPhoneNumber,
              60,
            ]),
          )
        })
      })

      describe('from a subscriber', () => {
        const subscriberExpiryUpdate = merge({}, expiryUpdate, {
          data: { source: subscriberPhoneNumber },
        })
        beforeEach(async () => {
          resolveMemberTypeStub.returns(Promise.resolve(memberTypes.SUBSCRIBER))
          app.sock.emit('data', JSON.stringify(subscriberExpiryUpdate))
          await wait(socketDelay)
        })

        it('sets the expiry time btw/ channel and sender back to original expiry time', () => {
          expect(setExpirationStub.getCall(0).args).to.eql([
            app.sock,
            channel.phoneNumber,
            subscriberPhoneNumber,
            defaultMessageExpiryTime,
          ])
        })
      })

      describe('from a rando', () => {
        const randoExpiryUpdate = merge({}, expiryUpdate, {
          data: { source: randoPhoneNumber },
        })
        beforeEach(async () => {
          resolveMemberTypeStub.returns(Promise.resolve(memberTypes.NONE))
          app.sock.emit('data', JSON.stringify(randoExpiryUpdate))
          await wait(socketDelay)
        })

        it('is ignored', () => {
          expect(setExpirationStub.callCount).to.eql(0)
        })
      })

      describe('with a message body', () => {
        const expiryUpdateWithBody = merge({}, expiryUpdate, {
          data: {
            source: randoPhoneNumber,
            dataMessage: {
              message: 'HELLO',
            },
          },
        })

        beforeEach(async () => {
          resolveMemberTypeStub.returns(Promise.resolve(memberTypes.NONE))
          app.sock.emit('data', JSON.stringify(expiryUpdateWithBody))
          await wait(socketDelay)
        })

        it('still relays message', async () => {
          expect(processCommandStub.getCall(0).args[0].sdMessage.messageBody).to.eql('HELLO')
        })
      })
    })
  })
})
