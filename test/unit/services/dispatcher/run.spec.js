import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { EventEmitter } from 'events'
import { languages } from '../../../../app/constants'
import { memberTypes } from '../../../../app/db/repositories/channel'
import { run } from '../../../../app/services/dispatcher/run'
import channelRepository from '../../../../app/db/repositories/channel'
import signal from '../../../../app/services/signal'
import executor from '../../../../app/services/dispatcher/commands'
import messenger from '../../../../app/services/dispatcher/messenger'
import safetyNumberService from '../../../../app/services/registrar/safetyNumbers'
import logger from '../../../../app/services/dispatcher/logger'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { wait } from '../../../../app/services/util'
import { messagesIn } from '../../../../app/services/dispatcher/strings/messages'
import { defaultLanguage } from '../../../../app/config'

describe('dispatcher service', () => {
  const db = {}
  const sock = new EventEmitter().setMaxListeners(30)
  const channels = times(2, () => ({ ...channelFactory(), publications: [], subscriptions: [] }))
  const channel = channels[0]
  const sender = genPhoneNumber()
  const authenticatedSender = {
    phoneNumber: sender,
    language: languages.EN,
    type: memberTypes.PUBLISHER,
  }
  const sdInMessage = {
    type: 'message',
    data: {
      username: channel.phoneNumber,
      source: sender,
      dataMessage: {
        timestamp: new Date().getTime(),
        message: 'foo',
        expiresInSeconds: 0,
        attachments: [],
      },
    },
  }
  const sdOutMessage = signal.parseOutboundSdMessage(sdInMessage)
  const socketDelay = 5

  let findAllDeepStub,
    findDeepStub,
    resolvememberTypestub,
    resolveSenderLanguageStub,
    subscribeStub,
    trustAndResendStub,
    deauthorizeStub,
    processCommandStub,
    dispatchStub,
    logAndReturnSpy,
    logErrorSpy

  beforeEach(async () => {
    // initialization stubs --v

    findAllDeepStub = sinon
      .stub(channelRepository, 'findAllDeep')
      .returns(Promise.resolve(channels))

    subscribeStub = sinon.stub(signal, 'subscribe').returns(Promise.resolve())

    // main loop stubs --^

    // on inboundMessage stubs --v

    findDeepStub = sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channels[0]))

    resolvememberTypestub = sinon
      .stub(channelRepository, 'resolveSenderType')
      .returns(Promise.resolve(memberTypes.PUBLISHER))

    resolveSenderLanguageStub = sinon
      .stub(channelRepository, 'resolveSenderLanguage')
      .returns(languages.EN)

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

    logAndReturnSpy = sinon.spy(logger, 'logAndReturn')
    logErrorSpy = sinon.spy(logger, 'error')
    // onReceivedMessage stubs --^

    await run(db, sock)
  })

  afterEach(() => {
    findAllDeepStub.restore()
    findDeepStub.restore()
    resolvememberTypestub.restore()
    resolveSenderLanguageStub.restore()
    trustAndResendStub.restore()
    deauthorizeStub.restore()
    processCommandStub.restore()
    dispatchStub.restore()
    subscribeStub.restore()
    logAndReturnSpy.restore()
    logErrorSpy.restore()
  })

  describe('handling an incoming message', () => {
    describe('when message is not relayable or a failed send attempt', () => {
      beforeEach(async () => {
        sock.emit('data', JSON.stringify({ type: 'message', data: { receipt: { type: 'READ' } } }))
        wait(socketDelay)
      })

      it('ignores the message', () => {
        expect(processCommandStub.callCount).to.eql(0)
        expect(dispatchStub.callCount).to.eql(0)
      })
    })

    describe('when message is dispatchable', () => {
      beforeEach(async () => {
        sock.emit('data', JSON.stringify(sdInMessage))
        await wait(socketDelay)
      })

      it('retrieves a channel record', () => {
        expect(findDeepStub.getCall(0).args).to.eql([db, channel.phoneNumber])
      })

      it('retrieves permissions for the message sender', () => {
        expect(resolvememberTypestub.getCall(0).args).to.eql([db, channel.phoneNumber, sender])
      })

      it('processes any commands in the message', () => {
        expect(processCommandStub.getCall(0).args[0]).to.eql({
          db,
          sock,
          channel,
          sender: authenticatedSender,
          sdMessage: sdOutMessage,
        })
      })

      it('passes the command result and original message to messenger for dispatch', () => {
        expect(dispatchStub.getCall(0).args[0]).to.eql({
          commandResult: { command: 'NOOP', status: 'SUCCESS', message: 'foo' },
          dispatchable: {
            db,
            sock,
            channel,
            sender: authenticatedSender,
            sdMessage: sdOutMessage,
          },
        })
      })
    })

    describe('when message is a failed send attempt', () => {
      const recipientNumber = genPhoneNumber()
      const messageBody = '[foo]\nbar'
      const sdErrorMessage = {
        type: signal.messageTypes.ERROR,
        data: {
          msg_number: 0,
          error: true,
          request: {
            type: 'send',
            username: channel.phoneNumber,
            messageBody,
            recipientNumber,
            attachments: [],
            expiresInSeconds: 0,
          },
        },
      }

      describe('when intended recipient is a subscriber', () => {
        beforeEach(async () => resolvememberTypestub.returns(memberTypes.SUBSCRIBER))

        it("attempts to trust the recipient's safety number and re-send the message", async () => {
          sock.emit('data', JSON.stringify(sdErrorMessage))
          await wait(socketDelay)

          expect(deauthorizeStub.callCount).to.eql(0) // does not attempt to deauthorize user
          expect(trustAndResendStub.getCall(0).args.slice(2)).to.eql([
            channel.phoneNumber,
            recipientNumber,
            sdErrorMessage.data.request,
          ])
        })

        describe('when trusting succeeds', () => {
          // this is the default stub
          it('logs the success', async () => {
            sock.emit('data', JSON.stringify(sdErrorMessage))
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
            sock.emit('data', JSON.stringify(sdErrorMessage))
            await wait(socketDelay)

            expect(logErrorSpy.getCall(0).args).to.eql([errorStatus])
          })
        })
      })

      describe('when intended recipient is an admin', () => {
        beforeEach(async () => resolvememberTypestub.returns(memberTypes.PUBLISHER))

        describe('when message is not a welcome message', () => {
          it('attempts to deauthorize the admin', async () => {
            sock.emit('data', JSON.stringify(sdErrorMessage))
            await wait(socketDelay)

            expect(trustAndResendStub.callCount).to.eql(0) // does not attempt to resend
            expect(deauthorizeStub.getCall(0).args.slice(2)).to.eql([
              channel.phoneNumber,
              recipientNumber,
            ])
          })

          describe('when deauth succeeds', () => {
            // this is the default stub
            it('logs the success', async () => {
              sock.emit('data', JSON.stringify(sdErrorMessage))
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
              sock.emit('data', JSON.stringify(sdErrorMessage))
              await wait(socketDelay)

              expect(logErrorSpy.getCall(0).args).to.eql([errorStatus])
            })
          })
        })

        describe('when message is a welcome message from an admin', () => {

          const welcomeMessage = `[foo]\n\n${messagesIn(defaultLanguage).notifications.welcome(
            genPhoneNumber(),
            channel.phoneNumber,
          )}`

          const failedWelcomeMessage = {
            type: signal.messageTypes.ERROR,
            data: {
              msg_number: 0,
              error: true,
              request: {
                type: 'send',
                username: channel.phoneNumber,
                messageBody: welcomeMessage,
                recipientNumber,
                attachments: [],
                expiresInSeconds: 0,
              },
            },
          }

          it('attempts to trust and resend the message', async () => {
            sock.emit('data', JSON.stringify(failedWelcomeMessage))
            await wait(socketDelay)

            expect(deauthorizeStub.callCount).to.eql(0) // does not attempt to deauthorize user
            expect(trustAndResendStub.getCall(0).args.slice(2)).to.eql([
              channel.phoneNumber,
              recipientNumber,
              failedWelcomeMessage.data.request,
            ])
          })
          // NOTE: we omit testing trust/resend success/failure as that is exhaustively tested above
        })

        describe('when message is a welcome message from a sysadmin', () => {
          const welcomeMessage = `[foo]\n\n${messagesIn(defaultLanguage).notifications.welcome(
            messagesIn(defaultLanguage).systemName,
            channel.phoneNumber,
          )}`
          const failedWelcomeMessage = {
            type: signal.messageTypes.ERROR,
            data: {
              msg_number: 0,
              error: true,
              request: {
                type: 'send',
                username: channel.phoneNumber,
                messageBody: welcomeMessage,
                recipientNumber,
                attachments: [],
                expiresInSeconds: 0,
              },
            },
          }

          it('attempts to trust and resend the message', async () => {
            sock.emit('data', JSON.stringify(failedWelcomeMessage))
            await wait(socketDelay)

            expect(deauthorizeStub.callCount).to.eql(0) // does not attempt to deauthorize user
            expect(trustAndResendStub.getCall(0).args.slice(2)).to.eql([
              channel.phoneNumber,
              recipientNumber,
              failedWelcomeMessage.data.request,
            ])
          })
          // NOTE: we omit testing trust/resend success/failure as that is exhaustively tested above
        })
      })

      describe('when message is a rate limit notification', () => {
        beforeEach(async () => resolvememberTypestub.returns(memberTypes.SUBSCRIBER))

        const rateLimitWarning = {
          type: signal.messageTypes.ERROR,
          data: {
            msg_number: 0,
            error: true,
            message: 'Rate limit exceeded: you are in big trouble!',
            request: {
              type: 'send',
              username: channel.phoneNumber,
              messageBody,
              recipientNumber,
              attachments: [],
              expiresInSeconds: 0,
            },
          },
        }

        it('drops the message', async () => {
          sock.emit('data', JSON.stringify(rateLimitWarning))
          await wait(socketDelay)

          expect(trustAndResendStub.callCount).to.eql(0) // does not attempt to resend
          expect(deauthorizeStub.callCount).to.eql(0) // does not attempt to deauth
        })
      })

      describe('and the recipient is a random person (why would this ever happen?)', () => {
        beforeEach(async () => resolvememberTypestub.returns(memberTypes.NONE))

        it('drops the message', async () => {
          sock.emit('data', JSON.stringify(sdInMessage))
          await wait(socketDelay)

          expect(trustAndResendStub.callCount).to.eql(0) // does not attempt to resend
          expect(deauthorizeStub.callCount).to.eql(0) // does not attempt to deauth
        })
      })
    })
  })
})
