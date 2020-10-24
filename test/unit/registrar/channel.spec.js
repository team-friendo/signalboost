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
  const name = '#blackops'
  const channelPhoneNumber = phoneNumber
  const welcomeNotification = messagesIn(defaultLanguage).notifications.welcome(
    messagesIn(defaultLanguage).systemName,
    channelPhoneNumber,
    name,
  )
  const admins = times(4, genPhoneNumber)
  const adminPhoneNumber = admins[0]
  const channelInstance = {
    phoneNumber,
    name,
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
    name: 'TRYSTERO',
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
    subscribeStub,
    updatePhoneNumberStub,
    sendMessageStub,
    findAllDeepStub,
    findDeepStub,
    issueStub,
    setExpirationStub,
    logStub

  beforeEach(() => {
    addAdminStub = sinon.stub(membershipRepository, 'addAdmin')
    createChannelStub = sinon.stub(channelRepository, 'create')
    subscribeStub = sinon.stub(signal, 'subscribe')
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    sendMessageStub = sinon.stub(signal, 'sendMessage')
    findAllDeepStub = sinon.stub(channelRepository, 'findAllDeep')
    findDeepStub = sinon.stub(channelRepository, 'findDeep')
    issueStub = sinon.stub(inviteRepository, 'issue')
    sinon.stub(channelRepository, 'findByPhoneNumber').returns(Promise.resolve(channelInstance))
    setExpirationStub = sinon.stub(signal, 'setExpiration').returns(Promise.resolve())
    logStub = sinon
      .stub(eventRepository, 'log')
      .returns(Promise.resolve(eventFactory({ type: eventTypes.CHANNEL_CREATED })))
  })

  afterEach(() => sinon.restore())

  describe('#create', () => {
    beforeEach(() => {
      updatePhoneNumberStub.returns(Promise.resolve({ phoneNumber, status: 'ACTIVE' }))
    })

    describe('when subscribing to signal messages succeeds', () => {
      beforeEach(() => subscribeStub.returns(Promise.resolve()))

      describe('in all cases', () => {
        beforeEach(async () => {
          await create({ phoneNumber, name, admins })
        })

        it('creates a channel resource', () => {
          expect(createChannelStub.getCall(0).args).to.eql([phoneNumber, name, admins])
        })

        it('subscribes to the new channel', () => {
          expect(subscribeStub.getCall(0).args).to.eql([phoneNumber, 0])
        })

        it('sets the phone number resource status to active', () => {
          expect(updatePhoneNumberStub.getCall(0).args).to.eql([phoneNumber, { status: 'ACTIVE' }])
        })
      })

      describe('when both db writes succeed', () => {
        beforeEach(() => {
          createChannelStub.returns(Promise.resolve(channelInstance))
          updatePhoneNumberStub.returns(Promise.resolve(activePhoneNumberInstance))
        })

        it('sends a welcome message to new admins', async () => {
          await create({ phoneNumber, name, admins, welcome: sendMessageStub })
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
          await create({ phoneNumber, name, admins, welcome: sendMessageStub })
          expect(logStub.getCall(0).args).to.eql([eventTypes.CHANNEL_CREATED, phoneNumber])
        })

        describe('when sending welcome messages succeeds', () => {
          beforeEach(() => {
            sendMessageStub.onCall(0).returns(Promise.resolve())
            sendMessageStub.onCall(1).returns(Promise.resolve())
          })

          it('sets the expiry time on the channel', async () => {
            const channel = await create({ phoneNumber, name, admins })
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
            beforeEach(() => findDeepStub.returns(Promise.resolve(supportChannel)))

            it('invites unsubscribed users to the support channel', async () => {
              await create({ phoneNumber, name, admins })
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
                    message: _welcomeNotificationOf(supportChannel),
                  }),
                  supportChannel.socketId,
                ])
              })
            })

            describe('when sending invites succeeds', () => {
              beforeEach(() => sendMessageStub.returns(Promise.resolve()))
              it('returns a success message', async function() {
                expect(await create({ phoneNumber, name, admins })).to.eql({
                  status: 'ACTIVE',
                  phoneNumber,
                  name,
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
                const result = await create({ phoneNumber, name, admins })
                expect(result).to.eql({
                  status: 'ERROR',
                  error: 'oh noooes!',
                  request: {
                    phoneNumber,
                    name,
                    admins,
                  },
                })
              })
            })
          })

          describe('when there is not a support channel', () => {
            beforeEach(() => findDeepStub.returns(Promise.resolve(null)))

            it('does not issue any invites', async () => {
              await create({ phoneNumber, name, admins })
              expect(issueStub.callCount).to.eql(0)
            })

            it('returns a success message', async function() {
              expect(await create({ phoneNumber, name, admins })).to.eql({
                status: 'ACTIVE',
                phoneNumber,
                name,
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
            const result = await create({ phoneNumber, name, admins })
            expect(result).to.eql({
              status: 'ERROR',
              error: 'oh noes!',
              request: {
                phoneNumber,
                name,
                admins,
              },
            })
          })
        })
      })

      describe('when creating channel fails', () => {
        let result
        beforeEach(async () => {
          createChannelStub.callsFake(() => Promise.reject(new Error('db error!')))
          result = await create({ phoneNumber, name, admins })
        })

        it('does not send welcome messages', () => {
          expect(sendMessageStub.callCount).to.eql(0)
        })

        it('returns an error message', () => {
          expect(result).to.eql({
            status: 'ERROR',
            error: 'db error!',
            request: {
              phoneNumber,
              name,
              admins,
            },
          })
        })
      })

      describe('when updating phone number fails', () => {
        let result
        beforeEach(async () => {
          createChannelStub.callsFake(() => Promise.reject(new Error('db error!')))
          result = await create({ phoneNumber, name, admins })
        })

        it('does not send welcome messages', () => {
          expect(sendMessageStub.callCount).to.eql(0)
        })

        it('returns an error message', () => {
          expect(result).to.eql({
            status: 'ERROR',
            error: 'db error!',
            request: {
              phoneNumber,
              name,
              admins,
            },
          })
        })
      })
    })

    describe('when subscribing to signal messages fails', () => {
      let result
      beforeEach(async () => {
        subscribeStub.callsFake(() => Promise.reject(new Error('oh noes!')))
        result = await create({ phoneNumber, name, admins })
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
          request: {
            phoneNumber,
            name,
            admins,
          },
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
                name: 'foo',
                phoneNumber: '+11111111111',
                socketId: 0,
                hash: 3092098404,
                admins: 2,
                subscribers: 2,
                messageCount: { broadcastIn: 2, commandIn: 5, hotlineIn: 4 },
              },
              {
                name: 'bar',
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
