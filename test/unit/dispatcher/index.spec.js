import { expect } from 'chai'
import { describe, it, beforeEach, afterEach, before, after } from 'mocha'
import sinon from 'sinon'
import { times, merge, map } from 'lodash'
import { languages } from '../../../app/language'
import { memberTypes } from '../../../app/db/repositories/membership'
import { dispatch } from '../../../app/dispatcher'
import channelRepository, { getAllAdminsExcept } from '../../../app/db/repositories/channel'
import membershipRepository from '../../../app/db/repositories/membership'
import safetyNumbers from '../../../app/registrar/safetyNumbers'
import metrics from '../../../app/metrics'
import phoneNumberRegistrar from '../../../app/registrar/phoneNumber'
import signal, { messageTypes } from '../../../app/signal'
import diagnostics from '../../../app/diagnostics'
import executor from '../../../app/dispatcher/commands'
import messenger from '../../../app/dispatcher/messenger'
import resend from '../../../app/dispatcher/resend'
import { deepChannelFactory } from '../../support/factories/channel'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { genUuid, wait } from '../../../app/util'
import app from '../../../app/index'
import testApp from '../../support/testApp'
import { genFingerprint, genSafetyNumber } from '../../support/factories/deauthorization'
import { membershipFactory } from '../../support/factories/membership'
import { messagesIn } from '../../../app/dispatcher/strings/messages'

const {
  signal: { defaultMessageExpiryTime, minResendInterval, diagnosticsPhoneNumber },
} = require('../../../app/config')

describe('dispatcher module', () => {
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
      source: { number: adminPhoneNumber },
      dataMessage: {
        timestamp: new Date().getTime(),
        body: 'foo',
        expiresInSeconds: defaultMessageExpiryTime,
        attachments: [],
      },
    },
  }
  const healthcheckId = genUuid()
  const healthcheck = {
    // type: messageTypes.SEND,
    // username: diagnosticsPhoneNumber,
    // messageBody: `${messageTypes.HEALTHCHECK} ${healthcheckId}`,
    // recipientAddress: { number: channels[0].phoneNumber },
    type: messageTypes.MESSAGE,
    data: {
      username: channels[0].phoneNumber,
      source: {
        number: diagnosticsPhoneNumber,
      },
      dataMessage: {
        timestamp: new Date().toISOString(),
        body: `${messageTypes.HEALTHCHECK} ${healthcheckId}`,
        expiresInSeconds: 0,
        attachments: [],
      },
    },
  }
  const healthcheckResponse = {
    type: messageTypes.MESSAGE,
    data: {
      username: diagnosticsPhoneNumber,
      source: {
        number: channels[0].phoneNumber,
      },
      dataMessage: {
        timestamp: new Date().toISOString(),
        body: `${messageTypes.HEALTHCHECK_RESPONSE} ${healthcheckId}`,
        expiresInSeconds: 0,
        attachments: [],
      },
    },
  }

  const sdOutMessage = signal.parseOutboundSdMessage(sdInMessage)
  const socketDelay = 5

  let findDeepStub,
    resolveMemberTypeStub,
    processCommandStub,
    dispatchStub,
    enqueueResendStub,
    respondToHealthcheckStub

  before(async () => await app.run(testApp))

  beforeEach(async () => {
    sinon.stub(channelRepository, 'findAllDeep').returns(Promise.resolve(channels))
    sinon.stub(signal, 'subscribe').returns(Promise.resolve())

    findDeepStub = sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channels[0]))

    respondToHealthcheckStub = sinon
      .stub(diagnostics, 'respondToHealthcheck')
      .returns(Promise.resolve('42'))

    resolveMemberTypeStub = sinon
      .stub(membershipRepository, 'resolveMemberType')
      .returns(Promise.resolve(memberTypes.ADMIN))

    sinon.stub(membershipRepository, 'resolveSenderLanguage').returns(languages.EN)

    processCommandStub = sinon
      .stub(executor, 'processCommand')
      .returns(Promise.resolve({ command: 'NOOP', status: 'SUCCESS', message: 'foo' }))

    dispatchStub = sinon.stub(messenger, 'dispatch').returns(Promise.resolve())

    sinon.stub(signal, 'sendMessage').returns(Promise.resolve())

    enqueueResendStub = sinon.stub(resend, 'enqueueResend')
  })

  afterEach(() => sinon.restore())

  after(() => app.stop())

  describe('handling an incoming message', () => {
    describe('deciding whether to dispatch a message', () => {
      describe('when message is not of type "message"', () => {
        it('ignores the message', async () => {
          await dispatch(
            JSON.stringify({
              type: 'list_groups',
              data: { username: '+12223334444' },
            }),
          )
          expect(processCommandStub.callCount).to.eql(0)
          expect(dispatchStub.callCount).to.eql(0)
        })
      })

      describe('when message is of type "message"', () => {
        describe('when message has a body', () => {
          it('dispatches the message', async () => {
            await dispatch(
              JSON.stringify({
                type: 'message',
                data: {
                  username: channel.phoneNumber,
                  source: genPhoneNumber(),
                  dataMessage: {
                    timestamp: new Date().toISOString(),
                    body: 'foobar',
                    expiresInSeconds: channel.messageExpiryTime,
                    attachments: [],
                  },
                },
              }),
            )
            expect(processCommandStub.callCount).to.be.above(0)
            expect(dispatchStub.callCount).to.be.above(0)
          })
        })

        describe('when message lacks a body but contains an attachment', () => {
          it('dispatches the message', async () => {
            await dispatch(
              JSON.stringify({
                type: 'message',
                data: {
                  source: {
                    number: genPhoneNumber(),
                  },
                  dataMessage: {
                    message: '',
                    attachments: ['cool pix!'],
                  },
                },
              }),
            )
            expect(processCommandStub.callCount).to.be.above(0)
            expect(dispatchStub.callCount).to.be.above(0)
          })
        })
      })
    })

    describe('when message lacks a body AND an attachment', () => {
      it('ignores the message', async () => {
        await dispatch(JSON.stringify({ type: 'message', data: { receipt: { type: 'READ' } } }))
        expect(processCommandStub.callCount).to.eql(0)
        expect(dispatchStub.callCount).to.eql(0)
      })
    })

    describe('dispatching a message', () => {
      beforeEach(async () => await dispatch(JSON.stringify(sdInMessage)))

      it('retrieves a channel record', () => {
        expect(findDeepStub.getCall(0).args).to.eql([channel.phoneNumber])
      })

      it('retrieves permissions for the message sender', () => {
        expect(resolveMemberTypeStub.getCall(0).args).to.eql([
          channel.phoneNumber,
          adminPhoneNumber,
        ])
      })

      it('processes any commands in the message', () => {
        expect(processCommandStub.getCall(0).args[0]).to.eql({
          channel,
          sender,
          sdMessage: sdOutMessage,
        })
      })

      it('passes the command result and original message to messenger for dispatch', () => {
        expect(dispatchStub.getCall(0).args[0]).to.eql({
          commandResult: { command: 'NOOP', status: 'SUCCESS', message: 'foo' },
          dispatchable: {
            channel,
            sender,
            sdMessage: sdOutMessage,
          },
        })
      })
    })

    describe('processing interventions', () => {
      describe('when message is a rate limit error notification', () => {
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
        let incrementCounterStub

        beforeEach(async () => {
          enqueueResendStub.returns(minResendInterval)
          incrementCounterStub = sinon.stub(metrics, 'incrementCounter')
          sinon.stub(channelRepository, 'getSocketId').returns(Promise.resolve(channel.socketId))
          await dispatch(JSON.stringify(sdErrorMessage), {})
          await wait(2 * socketDelay)
        })

        it('enqueues the message for resending', () => {
          expect(enqueueResendStub.getCall(0).args).to.eql([originalSdMessage, channel.socketId])
        })

        it('logs the rate limit error', () => {
          expect(map(incrementCounterStub.getCalls(), 'args')).to.have.deep.members([
            [
              metrics.counters.SIGNALD_MESSAGES,
              [signal.messageTypes.ERROR, channel.phoneNumber, metrics.messageDirection.INBOUND],
            ],
            [
              metrics.counters.ERRORS,
              [metrics.errorTypes.RATE_LIMIT_RESENDING, channel.phoneNumber],
            ],
          ])
        })
      })

      describe('inbound identity failure notifications', () => {
        const fingerprint = genFingerprint()
        const identityFailureMsg = {
          type: 'inbound_identity_failure',
          data: {
            local_address: { number: channel.phoneNumber, uuid: genUuid() },
            remote_address: { number: subscriberPhoneNumber },
            fingerprint,
            safety_number: genSafetyNumber(),
          },
        }

        let updateFingerprintStub
        beforeEach(async () => {
          sinon
            .stub(membershipRepository, 'findMembership')
            .returns(Promise.resolve(membershipFactory({ language: languages.FR })))
          updateFingerprintStub = sinon
            .stub(safetyNumbers, 'updateFingerprint')
            .returns(Promise.resolve({ status: 'SUCCESS', message: 'yay!' }))
        })

        it('updates the fingerprint of the new identity', async () => {
          await dispatch(JSON.stringify(identityFailureMsg))
          expect(updateFingerprintStub.getCall(0).args).to.eql([
            {
              channelPhoneNumber: channel.phoneNumber,
              memberPhoneNumber: subscriberPhoneNumber,
              fingerprint,
              sdMessage: {
                type: messageTypes.SEND,
                username: channel.phoneNumber,
                messageBody: messagesIn(languages.FR).notifications.safetyNumberChanged,
              },
            },
          ])
        })
      })

      describe('when message is a healthcheck', () => {
        it('responds to the healthcheck', async () => {
          await dispatch(JSON.stringify(healthcheck))
          expect(respondToHealthcheckStub.getCall(0).args).to.eql([channels[0], healthcheckId])
        })
      })

      describe('when message is a healthcheck resposne', () => {
        it('swallows message', async () => {
          await dispatch(JSON.stringify(healthcheckResponse))
          expect(dispatchStub.callCount).to.eql(0)
        })
      })
    })

    describe('processing side-effects', () => {
      describe('expiry time updates', () => {
        const expiryUpdate = merge({}, sdInMessage, {
          data: {
            dataMessage: {
              body: '',
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
          beforeEach(async () => await dispatch(JSON.stringify(expiryUpdate)))

          it('stores the new expiry time', () => {
            expect(updateStub.getCall(0).args).to.eql([
              channel.phoneNumber,
              { messageExpiryTime: 60 },
            ])
          })

          it('updates the expiry time between the channel and every other channel member', () => {
            getAllAdminsExcept(channel, [adminPhoneNumber]).forEach((membership, i) =>
              expect(setExpirationStub.getCall(i).args).to.eql([
                channel.phoneNumber,
                membership.memberPhoneNumber,
                60,
                channel.socketId,
              ]),
            )
          })
        })

        describe('from a subscriber', () => {
          const subscriberExpiryUpdate = merge({}, expiryUpdate, {
            data: { source: { number: subscriberPhoneNumber } },
          })
          beforeEach(async () => {
            resolveMemberTypeStub.returns(Promise.resolve(memberTypes.SUBSCRIBER))
            await dispatch(JSON.stringify(subscriberExpiryUpdate))
          })

          it('sets the expiry time btw/ channel and sender back to original expiry time', () => {
            expect(setExpirationStub.getCall(0).args).to.eql([
              channel.phoneNumber,
              subscriberPhoneNumber,
              defaultMessageExpiryTime,
              channel.socketId,
            ])
          })
        })

        describe('from a rando', () => {
          const randoExpiryUpdate = merge({}, expiryUpdate, {
            data: { source: randoPhoneNumber },
          })
          beforeEach(async () => {
            resolveMemberTypeStub.returns(Promise.resolve(memberTypes.NONE))
            await dispatch(JSON.stringify(randoExpiryUpdate))
          })

          it('is ignored', () => {
            expect(setExpirationStub.callCount).to.eql(0)
          })
        })

        describe('with a message body', () => {
          const expiryUpdateWithBody = merge({}, expiryUpdate, {
            data: {
              source: { number: randoPhoneNumber },
              dataMessage: {
                body: 'HELLO',
              },
            },
          })

          beforeEach(async () => {
            resolveMemberTypeStub.returns(Promise.resolve(memberTypes.NONE))
            await dispatch(JSON.stringify(expiryUpdateWithBody))
          })

          it('still relays message', async () => {
            expect(processCommandStub.getCall(0).args[0].sdMessage.messageBody).to.eql('HELLO')
          })
        })
      })

      describe('redemption messages from a channel with a pending destruction request', () => {
        let redeemStub
        beforeEach(() => {
          findDeepStub.returns(
            Promise.resolve({
              ...channel,
              destructionRequest: { channelPhoneNumber: channel.phoneNumber },
            }),
          )
          redeemStub = sinon.stub(phoneNumberRegistrar, 'redeem').returns(Promise.resolve())
        })

        it('redeems the channel and relays the message', async () => {
          await dispatch(JSON.stringify(sdInMessage))
          expect(redeemStub.getCall(0).args).to.eql([channel])
        })
      })

      describe('healthcheck response from a channel with a pending destruction request', () => {
        let redeemStub
        beforeEach(() => {
          findDeepStub.returns(
            Promise.resolve({
              ...channel,
              destructionRequest: { channelPhoneNumber: channel.phoneNumber },
            }),
          )
          redeemStub = sinon.stub(phoneNumberRegistrar, 'redeem').returns(Promise.resolve())
        })

        it('it does not redeem the channel', async () => {
          await dispatch(JSON.stringify(healthcheckResponse))
          expect(redeemStub.callCount).to.eql(0)
        })
      })
    })
  })
})
