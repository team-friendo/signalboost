import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { languages } from '../../../../app/constants'
import { memberTypes } from '../../../../app/db/repositories/membership'
import signal from '../../../../app/services/signal'
import messageCountRepository from '../../../../app/db/repositories/messageCount'
import messenger, { messageTypes } from '../../../../app/services/dispatcher/messenger'
import messages from '../../../../app/services/dispatcher/strings/messages/EN'
import { statuses, commands } from '../../../../app/services/dispatcher/commands/constants'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { sdMessageOf } from '../../../../app/services/signal'
import { messagesIn } from '../../../../app/services/dispatcher/strings/messages'
import { defaultLanguage } from '../../../../app/config'
import channelRepository from '../../../../app/db/repositories/channel'
const {
  signal: { signupPhoneNumber },
} = require('../../../../app/config')

describe('messenger service', () => {
  const notifications = messagesIn(defaultLanguage).notifications
  const [db, sock] = [{}, { write: () => {} }]
  const channelPhoneNumber = genPhoneNumber()
  const subscriberPhoneNumbers = times(2, genPhoneNumber)
  const adminPhoneNumbers = times(4, genPhoneNumber)
  const channel = {
    name: 'foobar',
    phoneNumber: channelPhoneNumber,
    memberships: [
      { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber: adminPhoneNumbers[0] },
      { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber: adminPhoneNumbers[1] },
      { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber: adminPhoneNumbers[2] },
      { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber: adminPhoneNumbers[3] },
      {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber,
        memberPhoneNumber: subscriberPhoneNumbers[0],
      },
      {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber,
        memberPhoneNumber: subscriberPhoneNumbers[1],
      },
    ],
    messageCount: { broadcastIn: 42 },
  }
  const responseEnabledChannel = { ...channel, responsesEnabled: true }
  const signupChannel = {
    name: 'SB_SIGNUP',
    phoneNumber: signupPhoneNumber,
    memberships: channel.memberships,
  }

  const attachments = [{ filename: 'some/path', width: 42, height: 42 }]
  const sdMessage = {
    type: 'send',
    messageBody: 'please help!',
    recipientNumber: genPhoneNumber(),
    attachments,
  }
  const adminSender = {
    phoneNumber: adminPhoneNumbers[0],
    type: memberTypes.ADMIN,
    language: languages.EN,
  }

  const subscriberSender = {
    phoneNumber: subscriberPhoneNumbers[0],
    type: memberTypes.SUBSCRIBER,
    language: languages.EN,
  }
  const randomSender = {
    phoneNumber: genPhoneNumber(),
    type: memberTypes.NONE,
    language: languages.EN,
  }

  describe('classifying a command result', () => {
    it('recognizes a broadcast message', () => {
      const msg = { command: 'foo', status: statuses.NOOP }
      const dispatchable = { channel, sender: adminSender }
      expect(messenger.parseMessageType(msg, dispatchable)).to.eql(messageTypes.BROADCAST_MESSAGE)
    })

    it('recognizes a hotline message from a subscriber', () => {
      const msg = { command: 'foo', status: statuses.NOOP }
      const dispatchable = { channel, sender: subscriberSender }
      expect(messenger.parseMessageType(msg, dispatchable)).to.eql(messageTypes.HOTLINE_MESSAGE)
    })

    it('recognizes a broadcast response from a random person', () => {
      const msg = { command: 'foo', status: statuses.NOOP }
      const dispatchable = { channel, sender: randomSender }
      expect(messenger.parseMessageType(msg, dispatchable)).to.eql(messageTypes.HOTLINE_MESSAGE)
    })

    it('recognizes a command result', () => {
      const msg = { command: 'JOIN', status: statuses.SUCCESS }
      const dispatchable = { channel, sender: randomSender }
      expect(messenger.parseMessageType(msg, dispatchable)).to.eql(messageTypes.COMMAND_RESULT)
    })
  })

  describe('dispatching a message', () => {
    let broadcastSpy,
      respondSpy,
      broadcastMessageStub,
      sendMessageStub,
      incrementCommandCountStub,
      incrementBroadcastCountStub

    beforeEach(() => {
      broadcastSpy = sinon.spy(messenger, 'broadcast')
      respondSpy = sinon.spy(messenger, 'respond')
      broadcastMessageStub = sinon.stub(signal, 'broadcastMessage').returns(Promise.resolve())
      sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve())
      incrementCommandCountStub = sinon
        .stub(messageCountRepository, 'incrementCommandCount')
        .returns(Promise.resolve())
      incrementBroadcastCountStub = sinon
        .stub(messageCountRepository, 'incrementBroadcastCount')
        .returns(Promise.resolve())
    })

    afterEach(() => {
      broadcastSpy.restore()
      respondSpy.restore()
      broadcastMessageStub.restore()
      sendMessageStub.restore()
      incrementCommandCountStub.restore()
      incrementBroadcastCountStub.restore()
    })

    describe('a hotline message', () => {
      describe('when sender is a admin', () => {
        beforeEach(
          async () =>
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, messageBody: messages.notifications.noop },
              dispatchable: { db, sock, channel, sender: adminSender, sdMessage },
            }),
        )
        it('does not respond to the sender', () => {
          expect(respondSpy.callCount).to.eql(0)
        })

        it('does not increment the command count for the channel', () => {
          expect(incrementCommandCountStub.callCount).to.eql(0)
        })

        it('broadcasts the message to all channel subscribers and admins', () => {
          expect(broadcastMessageStub.getCall(0).args).to.eql([
            sock,
            [...adminPhoneNumbers, ...subscriberPhoneNumbers],
            { ...sdMessage, messageBody: '[foobar]\nplease help!' },
          ])
        })

        it('it increments the command count for the channel', () => {
          expect(incrementBroadcastCountStub.getCall(0).args).to.eql([db, channel.phoneNumber, 6])
        })
      })

      describe('when sender is a subscriber', () => {
        describe('and responses are disabled', () => {
          const sender = subscriberSender

          beforeEach(async () => {
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, messageBody: messages.notifications.noop },
              dispatchable: { db, sock, channel, sender, sdMessage },
            })
          })

          it('does not broadcast a message', () => {
            expect(broadcastSpy.callCount).to.eql(0)
          })

          it('sends an error message to the message sender', () => {
            expect(sendMessageStub.getCall(0).args).to.eql([
              sock,
              sender.phoneNumber,
              sdMessageOf(channel, messages.notifications.hotlineMessagesDisabled(true)),
            ])
          })
        })

        describe('and responses are enabled', () => {
          const sender = subscriberSender

          beforeEach(async () => {
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, messageBody: messages.notifications.noop },
              dispatchable: { db, sock, channel: responseEnabledChannel, sender, sdMessage },
            })
          })

          it('forwards the message to channel admins', () => {
            expect(broadcastMessageStub.getCall(0).args).to.eql([
              sock,
              adminPhoneNumbers,
              { ...sdMessage, messageBody: `[SUBSCRIBER RESPONSE]\n${sdMessage.messageBody}` },
            ])
          })

          it('responds to sender with a broadcast response notification', () => {
            expect(sendMessageStub.getCall(0).args).to.eql([
              sock,
              sender.phoneNumber,
              sdMessageOf(channel, messages.notifications.hotlineMessageSent(channel)),
            ])
          })
        })
      })

      describe('when sender is a random person', () => {
        const sender = randomSender

        describe('and responses are enabled', () => {
          beforeEach(async () => {
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, messageBody: messages.notifications.noop },
              dispatchable: { db, sock, channel: responseEnabledChannel, sender, sdMessage },
            })
          })

          it('forwards the message to channel admins', () => {
            expect(broadcastMessageStub.getCall(0).args).to.eql([
              sock,
              adminPhoneNumbers,
              { ...sdMessage, messageBody: `[SUBSCRIBER RESPONSE]\n${sdMessage.messageBody}` },
            ])
          })

          it('responds to sender with a broadcast response notification', () => {
            expect(sendMessageStub.getCall(0).args).to.eql([
              sock,
              sender.phoneNumber,
              sdMessageOf(channel, messages.notifications.hotlineMessageSent(channel)),
            ])
          })
        })
      })
    })

    describe('when message is a signup request', () => {
      const adminPhoneNumbers = channelRepository.getAdminPhoneNumbers(channel)

      beforeEach(async () => {
        const dispatchable = {
          db,
          sock,
          channel: signupChannel,
          sender: randomSender,
          sdMessage: sdMessageOf(signupChannel, 'gimme a channel'),
        }
        const commandResult = { status: commands.NOOP, message: '', notificatioms: [] }
        await messenger.dispatch({ dispatchable, commandResult })
      })

      it('forwards request to channel admins and appends phone number', () => {
        adminPhoneNumbers.forEach((adminPhoneNumber, index) => {
          expect(sendMessageStub.getCall(index).args).to.eql([
            sock,
            adminPhoneNumber,
            sdMessageOf(
              signupChannel,
              notifications.signupRequestReceived(randomSender.phoneNumber, 'gimme a channel'),
            ),
          ])
        })
      })

      it('responds to requester', () => {
        expect(sendMessageStub.getCall(adminPhoneNumbers.length).args).to.eql([
          sock,
          randomSender.phoneNumber,
          sdMessageOf(signupChannel, notifications.signupRequestResponse),
        ])
      })
    })

    describe('when message is a command response', () => {
      // TODO(aguestuser|mari): loop over all commands here
      beforeEach(async () => {
        await messenger.dispatch({
          dispatchable: { db, sock, channel, sender: adminSender, sdMessage: commands.JOIN },
          commandResult: {
            command: commands.JOIN,
            status: statuses.SUCCESS,
            message: 'yay!',
            notifications: [],
          },
        })
      })

      it('does not broadcast a message', () => {
        expect(broadcastSpy.callCount).to.eql(0)
      })

      it('does not increment the broadcast count', () => {
        expect(incrementBroadcastCountStub.callCount).to.eql(0)
      })

      it('sends a command result to the message sender', () => {
        expect(sendMessageStub.getCall(0).args).to.eql([
          sock,
          adminSender.phoneNumber,
          sdMessageOf(channel, 'yay!'),
        ])
      })

      it('increments the command count for the channel', () => {
        expect(incrementCommandCountStub.getCall(0).args).to.eql([db, channel.phoneNumber])
      })
    })

    describe('when command requires notification(s)', () => {
      const bystanderPhoneNumbers = adminPhoneNumbers.slice(1, 4)

      describe('for an ADD command', () => {
        const newAdminPhoneNumber = genPhoneNumber()
        const sdMessage = `${commands.ADD} ${newAdminPhoneNumber}`
        const commandResponse = messages.commandResponses.add.success(newAdminPhoneNumber)
        const welcome = messages.notifications.welcome(adminSender.phoneNumber, channel.phoneNumber)
        const notificationMessage = messages.notifications.adminAdded

        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: { db, sock, channel, sender: adminSender, sdMessage },
            commandResult: {
              command: commands.ADD,
              status: statuses.SUCCESS,
              message: commandResponse,
              notifications: [
                {
                  recipient: newAdminPhoneNumber,
                  message: welcome,
                },
                ...bystanderPhoneNumbers.map(phoneNumber => ({
                  recipient: phoneNumber,
                  message: notificationMessage,
                })),
              ],
            },
          })
        })

        it('sends a welcome notification to the newly added admin', () => {
          expect(sendMessageStub.getCall(1).args).to.eql([
            sock,
            newAdminPhoneNumber,
            sdMessageOf(channel, welcome),
          ])
        })

        it('sends an alert to the other channel admins', () => {
          bystanderPhoneNumbers.forEach((phoneNumber, index) => {
            expect(sendMessageStub.getCall(index + 2).args).to.eql([
              sock,
              bystanderPhoneNumbers[index],
              sdMessageOf(channel, notificationMessage),
            ])
          })
        })
      })

      describe('for a REMOVE command', () => {
        const remover = adminSender
        const removedPhoneNumber = adminPhoneNumbers[1]
        const bystanderPhoneNumbers = [adminPhoneNumbers[2], adminPhoneNumbers[3]]
        const sdMessage = `${commands.REMOVE} ${removedPhoneNumber}`

        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: {
              db,
              sock,
              channel,
              sender: remover,
              sdMessage,
            },
            commandResult: {
              command: commands.REMOVE,
              status: statuses.SUCCESS,
              notifications: [
                {
                  recipient: removedPhoneNumber,
                  message: messages.notifications.toRemovedAdmin,
                },
                {
                  recipient: bystanderPhoneNumbers[0],
                  message: messages.notifications.adminRemoved,
                },
                {
                  recipient: bystanderPhoneNumbers[1],
                  message: messages.notifications.adminRemoved,
                },
              ],
            },
          })
        })

        it('notifies the removed admin', () => {
          expect(sendMessageStub.getCall(1).args).to.eql([
            sock,
            removedPhoneNumber,
            sdMessageOf(channel, messages.notifications.toRemovedAdmin),
          ])
        })

        it('notifies all other admins', () => {
          expect(sendMessageStub.getCall(2).args).to.eql([
            sock,
            bystanderPhoneNumbers[0],
            sdMessageOf(channel, messages.notifications.adminRemoved),
          ])
          expect(sendMessageStub.getCall(3).args).to.eql([
            sock,
            bystanderPhoneNumbers[1],
            sdMessageOf(channel, messages.notifications.adminRemoved),
          ])
        })
      })

      describe('for a RENAME command', () => {
        const commandResponse = messages.commandResponses.rename.success
        const sdMessage = `${commands.RENAME} floof`
        const notificationMessage = `${messages.notifications.channelRenamed(
          channel.name,
          'floof',
        )}`

        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: {
              db,
              sock,
              channel,
              sender: adminSender,
              sdMessage,
            },
            commandResult: {
              command: commands.RENAME,
              status: statuses.SUCCESS,
              message: commandResponse,
              notifications: [
                ...bystanderPhoneNumbers.map(phoneNumber => ({
                  recipient: phoneNumber,
                  message: notificationMessage,
                })),
              ],
            },
          })
        })

        it('notifies all admins except sender', () => {
          bystanderPhoneNumbers.forEach((phoneNumber, index) => {
            expect(sendMessageStub.getCall(index + 1).args).to.eql([
              sock,
              phoneNumber,
              sdMessageOf(channel, notificationMessage),
            ])
          })
        })
      })

      describe('for LEAVE command (admin only)', () => {
        const sdMessage = `${commands.LEAVE}`
        const commandResponse = messages.commandResponses.leave.success
        const notificationMessage = `${messages.notifications.adminLeft}`

        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: {
              db,
              sock,
              channel,
              sender: adminSender,
              sdMessage,
            },
            commandResult: {
              command: commands.LEAVE,
              status: statuses.SUCCESS,
              message: commandResponse,
              notifications: [
                ...bystanderPhoneNumbers.map(phoneNumber => ({
                  recipient: phoneNumber,
                  message: notificationMessage,
                })),
              ],
            },
          })
        })

        it('notifies all admins except sender', () => {
          bystanderPhoneNumbers.forEach((phoneNumber, index) => {
            expect(sendMessageStub.getCall(index + 1).args).to.eql([
              sock,
              phoneNumber,
              sdMessageOf(channel, notificationMessage),
            ])
          })
        })
      })

      describe('for an INVITE command', () => {
        const inviteePhoneNumber = genPhoneNumber()
        const sdMessage = sdMessageOf(channel, `${commands.invite} ${inviteePhoneNumber}`)
        const dispatchable = { db, sock, channel, sender: adminSender, sdMessage }
        const commandResult = {
          command: commands.INVITE,
          status: statuses.SUCCESS,
          message: messages.commandResponses.invite.success,
          notifications: [
            {
              recipient: inviteePhoneNumber,
              message: messagesIn(channel.language).notifications.inviteReceived(channel.name),
            },
          ],
        }

        it('sends an invite notification to the invitee', async () => {
          await messenger.dispatch({ dispatchable, commandResult })
          expect(sendMessageStub.getCall(1).args).to.eql([
            sock,
            inviteePhoneNumber,
            sdMessageOf(channel, messages.notifications.inviteReceived(channel.name)),
          ])
        })
      })
    })
  })

  describe('message headers', () => {
    describe('broadcast messages', () => {
      it('adds a channel name header', () => {
        const msg = { channel, sdMessage: sdMessageOf(channel, 'blah') }
        expect(messenger.addHeader(msg)).to.eql(sdMessageOf(channel, '[foobar]\nblah'))
      })
    })

    describe('hotline responses', () => {
      it('adds an INCOMING MESSAGE header', () => {
        // TODO(aguestuser|2019-12-21): make naming consistent here (hotline v. incoming)
        const msg = {
          channel,
          sdMessage: sdMessageOf(channel, 'blah'),
          messageType: messageTypes.HOTLINE_MESSAGE,
          language: languages.EN,
        }
        expect(messenger.addHeader(msg)).to.eql(
          sdMessageOf(channel, `[${messages.prefixes.hotlineMessage}]\nblah`),
        )
      })
    })
  })
})
