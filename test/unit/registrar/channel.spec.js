import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import channelRepository from '../../../app/db/repositories/channel'
import eventRepository from '../../../app/db/repositories/event'
import membershipRepository, { memberTypes } from '../../../app/db/repositories/membership'
import phoneNumberRepository from '../../../app/db/repositories/phoneNumber'
import inviteRepository from '../../../app/db/repositories/invite'
import signal from '../../../app/signal'
import notifier from '../../../app/notifier'
import { sdMessageOf } from '../../../app/signal/constants'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { deepChannelAttrs } from '../../support/factories/channel'
import { statuses } from '../../../app/util'
import { create, addAdmin, list, _welcomeNotificationOf } from '../../../app/registrar/channel'
import { messagesIn } from '../../../app/dispatcher/strings/messages'
import { eventTypes } from '../../../app/db/models/event'
import { eventFactory } from '../../support/factories/event'
const {
  signal: { defaultMessageExpiryTime },
  defaultLanguage,
} = require('../../../app/config')

describe('channel registrar', () => {
  const phoneNumber = genPhoneNumber()
  const channelPhoneNumber = phoneNumber
  const welcomeNotification = messagesIn(defaultLanguage).notifications.welcome(
    messagesIn(defaultLanguage).systemName,
    channelPhoneNumber,
  )
  const admins = times(4, genPhoneNumber)
  const adminPhoneNumber = admins[0]
  const channelInstance = {
    phoneNumber,
    memberships: [
      { type: memberTypes.ADMIN, channelPhoneNumber: phoneNumber, memberPhoneNumber: admins[0] },
      { type: memberTypes.ADMIN, channelPhoneNumber: phoneNumber, memberPhoneNumber: admins[1] },
      { type: memberTypes.ADMIN, channelPhoneNumber: phoneNumber, memberPhoneNumber: admins[2] },
      { type: memberTypes.ADMIN, channelPhoneNumber: phoneNumber, memberPhoneNumber: admins[3] },
    ],
  }
  const activePhoneNumberInstance = {
    phoneNumber,
    status: 'ACTIVE',
  }
  const supportPhoneNumber = genPhoneNumber()
  const supportChannel = {
    phoneNumber: supportPhoneNumber,
    memberships: [
      {
        type: memberTypes.ADMIN,
        channelPhoneNumber: supportPhoneNumber,
        memberPhoneNumber: admins[0],
      },
      {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber: supportPhoneNumber,
        memberPhoneNumber: admins[1],
      },
    ],
  }

  let addAdminStub,
    createChannelStub,
    countChannelsStub,
    listPhoneNumberStub,
    subscribeStub,
    updatePhoneNumberStub,
    sendMessageStub,
    findAllDeepStub,
    findDeepStub,
    issueStub,
    notifyMaintainersStub,
    setExpirationStub,
    logStub

  beforeEach(() => {
    addAdminStub = sinon.stub(membershipRepository, 'addAdmin')
    createChannelStub = sinon.stub(channelRepository, 'create')
    countChannelsStub = sinon.stub(channelRepository, 'count')
    listPhoneNumberStub = sinon.stub(phoneNumberRepository, 'list')
    subscribeStub = sinon.stub(signal, 'subscribe')
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    sendMessageStub = sinon.stub(signal, 'sendMessage')
    findAllDeepStub = sinon.stub(channelRepository, 'findAllDeep')
    findDeepStub = sinon.stub(channelRepository, 'findDeep')
    issueStub = sinon.stub(inviteRepository, 'issue')
    sinon.stub(channelRepository, 'findByPhoneNumber').returns(Promise.resolve(channelInstance))
    notifyMaintainersStub = sinon.stub(notifier, 'notifyMaintainers')
    setExpirationStub = sinon.stub(signal, 'setExpiration').returns(Promise.resolve())
    logStub = sinon
      .stub(eventRepository, 'log')
      .returns(Promise.resolve(eventFactory({ type: eventTypes.CHANNEL_CREATED })))
  })

  afterEach(() => sinon.restore())

  describe('#create', () => {
    describe("when there aren't any available phone numbers for channel creation", () => {
      const availablePhoneNumbers = []
      beforeEach(() => {
        updatePhoneNumberStub.returns(Promise.resolve({ phoneNumber, status: 'ACTIVE' }))
        listPhoneNumberStub.returns(Promise.resolve(availablePhoneNumbers))
        countChannelsStub.returns(Promise.resolve(10))
      })

      describe('when trying to create a new channel', () => {
        let res
        beforeEach(async () => (res = await create(admins)))

        it('notifies maintainers of a failed channel creation', () => {
          expect(notifyMaintainersStub.getCall(0).args).to.eql([
            messagesIn(defaultLanguage).notifications.channelCreationResult(false, 0, 10),
          ])
        })

        it('returns an error status', () => {
          expect(res).to.eql({
            status: statuses.UNAVAILABLE,
            error: 'No available phone numbers!',
            request: { admins },
          })
        })
      })
    })

    describe('when the system has verified phone numbers available', () => {
      const availablePhoneNumbers = [
        { phoneNumber, status: 'VERIFIED' },
        { phoneNumber: genPhoneNumber(), status: 'VERIFIED' },
        { phoneNumber: genPhoneNumber(), status: 'VERIFIED' },
      ]
      beforeEach(() => {
        updatePhoneNumberStub.returns(Promise.resolve({ phoneNumber, status: 'ACTIVE' }))
        listPhoneNumberStub.returns(Promise.resolve(availablePhoneNumbers))
        notifyMaintainersStub.returns(Promise.resolve())
      })

      describe('when subscribing to signal messages succeeds', () => {
        beforeEach(() => {
          subscribeStub.returns(Promise.resolve())
        })

        describe('when an admin passes in a phoneNumber', () => {
          const maintainerSpecifiedPhoneNumber = genPhoneNumber()
          beforeEach(async () => {
            await create(admins, maintainerSpecifiedPhoneNumber)
          })

          it('creates a channel resource', () => {
            expect(createChannelStub.getCall(0).args).to.eql([
              maintainerSpecifiedPhoneNumber,
              admins,
            ])
          })
        })

        describe('when a phone number is not specified', () => {
          beforeEach(async () => {
            await create(admins)
          })

          it('creates a channel resource', () => {
            expect(createChannelStub.getCall(0).args).to.eql([phoneNumber, admins])
          })

          it('subscribes to the new channel', () => {
            expect(subscribeStub.getCall(0).args).to.eql([phoneNumber, 0])
          })

          it('sets the phone number resource status to active', () => {
            expect(updatePhoneNumberStub.getCall(0).args).to.eql([
              phoneNumber,
              { status: 'ACTIVE' },
            ])
          })
        })

        describe('when both db writes succeed', () => {
          beforeEach(() => {
            createChannelStub.returns(Promise.resolve(channelInstance))
            updatePhoneNumberStub.returns(Promise.resolve(activePhoneNumberInstance))
          })

          it('sends a welcome message to new admins', async () => {
            await create(admins)
            admins.forEach((adminPhoneNumber, idx) => {
              expect(sendMessageStub.getCall(idx).args).to.eql([
                sdMessageOf({
                  sender: channelInstance.phoneNumber,
                  recipient: adminPhoneNumber,
                  message: _welcomeNotificationOf(channelInstance),
                }),
                channelInstance.socketId,
              ])
            })
          })

          it('logs the channel creation', async () => {
            await create(admins)
            expect(logStub.getCall(0).args).to.eql([eventTypes.CHANNEL_CREATED, phoneNumber])
          })

          describe('when sending welcome messages succeeds', () => {
            beforeEach(() => {
              sendMessageStub.onCall(0).returns(Promise.resolve())
              sendMessageStub.onCall(1).returns(Promise.resolve())
            })

            it('sets the expiry time on the channel', async () => {
              const channel = await create(admins)
              admins.forEach((adminPhoneNumber, idx) => {
                expect(setExpirationStub.getCall(idx).args).to.eql([
                  channelPhoneNumber,
                  adminPhoneNumber,
                  defaultMessageExpiryTime,
                  channel.socketId,
                ])
              })
            })

            describe('when there is a support channel', () => {
              beforeEach(() => {
                findDeepStub.returns(Promise.resolve(supportChannel))
                countChannelsStub.returns(Promise.resolve(10))
              })

              it('alerts maintainers that a new channel has been created', async () => {
                await create(admins)
                expect(notifyMaintainersStub.getCall(0).args).to.eql([
                  messagesIn(defaultLanguage).notifications.channelCreationResult(true, 2, 10),
                ])
              })

              it('invites unsubscribed users to the support channel', async () => {
                await create(admins)
                ;[admins[2], admins[3]].forEach((adminPhoneNumber, idx) => {
                  expect(issueStub.getCall(idx).args).to.eql([
                    supportPhoneNumber,
                    supportPhoneNumber,
                    adminPhoneNumber,
                  ])
                  expect(sendMessageStub.getCall(admins.length + idx).args).to.eql([
                    sdMessageOf({
                      sender: supportChannel.phoneNumber,
                      recipient: adminPhoneNumber,
                      message: messagesIn(defaultLanguage).notifications.invitedToSupportChannel,
                    }),
                    supportChannel.socketId,
                  ])
                })
              })

              describe('when sending invites succeeds', () => {
                beforeEach(() => sendMessageStub.returns(Promise.resolve()))
                it('returns a success message', async function() {
                  expect(await create(admins)).to.eql({
                    status: 'ACTIVE',
                    phoneNumber,

                    admins,
                  })
                })
              })
              describe('when sending invites fails', () => {
                beforeEach(() =>
                  sendMessageStub
                    .onCall(admins.length + 1)
                    .callsFake(() => Promise.reject(new Error('oh noooes!'))),
                )

                it('returns an error message', async () => {
                  const result = await create(admins)
                  expect(result).to.eql({
                    status: 'ERROR',
                    error: 'oh noooes!',
                    request: {
                      admins,
                    },
                  })
                })
              })
            })

            describe('when there is not a support channel', () => {
              beforeEach(() => findDeepStub.returns(Promise.resolve(null)))

              it('does not issue any invites', async () => {
                await create(admins)
                expect(issueStub.callCount).to.eql(0)
              })

              it('returns a success message', async function() {
                expect(await create(admins)).to.eql({
                  status: 'ACTIVE',
                  phoneNumber,
                  admins,
                })
              })
            })
          })

          describe('when sending welcome message fails', () => {
            beforeEach(() => {
              sendMessageStub.callsFake(() => Promise.reject(new Error('oh noes!')))
            })

            it('returns an error message', async () => {
              const result = await create(admins)
              expect(result).to.eql({
                status: 'ERROR',
                error: 'oh noes!',
                request: { admins },
              })
            })
          })
        })

        describe('when creating channel fails', () => {
          let result
          const dbError = new Error('db error!')
          beforeEach(async () => {
            createChannelStub.callsFake(() => Promise.reject(dbError))
            result = await create(admins)
          })

          it('does not send welcome messages', () => {
            expect(sendMessageStub.callCount).to.eql(0)
          })

          it('notifies maintainers of the failure', () => {
            expect(notifyMaintainersStub.getCall(0).args).to.eql([
              messagesIn(defaultLanguage).notifications.channelCreationError(dbError),
            ])
          })

          it('returns an error message', () => {
            expect(result).to.eql({
              status: 'ERROR',
              error: 'db error!',
              request: { admins },
            })
          })
        })

        describe('when updating phone number fails', () => {
          let result
          beforeEach(async () => {
            createChannelStub.callsFake(() => Promise.reject(new Error('db error!')))
            result = await create(admins)
          })

          it('does not send welcome messages', () => {
            expect(sendMessageStub.callCount).to.eql(0)
          })

          it('returns an error message', () => {
            expect(result).to.eql({
              status: 'ERROR',
              error: 'db error!',
              request: { admins },
            })
          })
        })
      })

      describe('when subscribing to signal messages fails', () => {
        let result
        beforeEach(async () => {
          subscribeStub.callsFake(() => Promise.reject(new Error('oh noes!')))
          result = await create(admins)
        })

        it('does not create channel record', () => {
          expect(createChannelStub.callCount).to.eql(0)
        })

        it('does not update phone number record', () => {
          expect(updatePhoneNumberStub.callCount).to.eql(0)
        })

        it('does not send welcome messages', () => {
          expect(sendMessageStub.callCount).to.eql(0)
        })

        it('returns an error message', () => {
          expect(result).to.eql({
            status: 'ERROR',
            error: 'oh noes!',
            request: { admins },
          })
        })
      })
    })
  })

  describe('#addAdmin', () => {
    it('attempts to add a admin to a channel', async () => {
      await addAdmin({ channelPhoneNumber, adminPhoneNumber })
      expect(addAdminStub.getCall(0).args).to.eql([channelPhoneNumber, adminPhoneNumber])
    })

    describe('when adding admin succeeds', () => {
      beforeEach(() => addAdminStub.returns(Promise.resolve()))

      it('attempts to send welcome message', async () => {
        await addAdmin({ channelPhoneNumber, adminPhoneNumber })
        expect(sendMessageStub.getCall(0).args).to.eql([
          sdMessageOf({
            sender: channelInstance.phoneNumber,
            recipient: adminPhoneNumber,
            message: _welcomeNotificationOf(channelInstance),
          }),
          channelInstance.socketId,
        ])
      })

      describe('when welcome message succeeds', () => {
        beforeEach(() => sendMessageStub.returns(Promise.resolve()))

        it('returns a success status', async () => {
          expect(await addAdmin({ channelPhoneNumber, adminPhoneNumber })).to.eql({
            status: statuses.SUCCESS,
            message: welcomeNotification,
          })
        })
      })

      describe('when welcome message fails', () => {
        const errorStatus = { status: 'ERROR', message: 'error!' }
        beforeEach(() => sendMessageStub.callsFake(() => Promise.reject(errorStatus)))

        it('returns an error status', async () => {
          const err = await addAdmin({
            channelPhoneNumber,
            adminPhoneNumber,
          }).catch(e => e)
          expect(err).to.eql(errorStatus)
        })
      })
    })

    describe('when adding admin fails', () => {
      const errorStatus = { status: 'ERROR', message: 'error!' }
      beforeEach(() => addAdminStub.callsFake(() => Promise.reject(errorStatus)))
      it('returns an error status', async () => {
        const err = await addAdmin({
          channelPhoneNumber,
          adminPhoneNumber,
        }).catch(e => e)
        expect(err).to.eql(errorStatus)
      })
    })
  })

  describe('#list', () => {
    const channels = deepChannelAttrs.map(ch => ({
      ...ch,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    describe('when db fetch succeeds', () => {
      beforeEach(() => findAllDeepStub.returns(Promise.resolve(channels)))

      it('presents a list of formatted phone numbers and a count (sorted by subscribers)', async () => {
        expect(await list({})).to.eql({
          status: 'SUCCESS',
          data: {
            count: 2,
            channels: [
              {
                phoneNumber: '+11111111111',
                socketId: 0,
                hash: 3092098404,
                admins: 2,
                subscribers: 2,
                messageCount: { broadcastIn: 2, commandIn: 5, hotlineIn: 4 },
              },
              {
                phoneNumber: '+19999999999',
                socketId: 1,
                hash: 3536709732,
                admins: 1,
                subscribers: 1,
                messageCount: { broadcastIn: 100, commandIn: 20, hotlineIn: 2 },
              },
            ],
          },
        })
      })
    })

    describe('when db fetch fails', () => {
      beforeEach(() => findAllDeepStub.callsFake(() => Promise.reject('oh noes!')))

      it('presents a list of phone numbers and a count', async () => {
        expect(await list({})).to.eql({
          status: 'ERROR',
          data: {
            error: 'oh noes!',
          },
        })
      })
    })
  })
})
