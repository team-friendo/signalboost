import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import signal from '../../../../app/services/dispatcher/signal'
import messageCountRepository from '../../../../app/db/repositories/messageCount'
import messenger from '../../../../app/services/dispatcher/messenger'
import messages from '../../../../app/services/dispatcher/messages'
import { statuses, commands } from '../../../../app/services/dispatcher/executor'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('messenger service', () => {
  const [db, iface] = [{}, {}]
  const channelPhoneNumber = genPhoneNumber()
  const subscriberNumbers = times(2, genPhoneNumber)
  const adminNumber = genPhoneNumber()
  const channel = {
    name: 'foobar',
    phoneNumber: channelPhoneNumber,
    administrations: [{ channelPhoneNumber, humanPhoneNumber: adminNumber }],
    subscriptions: [
      { channelPhoneNumber, humanPhoneNumber: subscriberNumbers[0] },
      { channelPhoneNumber, humanPhoneNumber: subscriberNumbers[1] },
    ],
  }
  const attachments = 'some/path'
  const message = 'please help!'
  const adminSender = {
    phoneNumber: adminNumber,
    isAdmin: true,
    isSubscriber: true,
  }
  const subscriberSender = {
    phoneNumber: subscriberNumbers[0],
    isAdmin: false,
    isSubscriber: true,
  }
  let broadcastSpy,
    respondSpy,
    sendMessageStub,
    incrementCommandCountStub,
    incrementBroadcastCountStub

  beforeEach(() => {
    broadcastSpy = sinon.spy(messenger, 'broadcast')
    respondSpy = sinon.spy(messenger, 'respond')
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
    sendMessageStub.restore()
    incrementCommandCountStub.restore()
    incrementBroadcastCountStub.restore()
  })

  describe('dispatching a message', () => {
    describe('when message is a command that was executed', () => {
      beforeEach(async () => {
        await messenger.dispatch({
          dispatchable: { db, iface, channel, sender: adminSender, message: commands.JOIN },
          commandResult: { command: commands.JOIN, status: statuses.SUCCESS, message: 'yay!' },
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
          iface,
          '[foobar]\nyay!',
          [adminSender.phoneNumber],
        ])
      })

      it('increments the command count for the channel', () => {
        expect(incrementCommandCountStub.getCall(0).args).to.eql([db, channel.phoneNumber])
      })
    })

    describe('when message is a broadcast message', () => {
      describe('when sender is an admin', () => {
        beforeEach(
          async () =>
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, message: messages.noop },
              dispatchable: { db, iface, channel, sender: adminSender, message, attachments },
            }),
        )
        it('does not respond to the sender', () => {
          expect(respondSpy.callCount).to.eql(0)
        })

        it('does not imcrement the command count for the channel', () => {
          expect(incrementCommandCountStub.callCount).to.eql(0)
        })

        it('broadcasts the message to all channel subscribers', () => {
          expect(sendMessageStub.getCall(0).args).to.eql([
            iface,
            '[foobar]\nplease help!',
            subscriberNumbers,
            'some/path',
          ])
        })

        it('it increments the command count for the channel', () => {
          expect(incrementBroadcastCountStub.getCall(0).args).to.eql([db, channel.phoneNumber, 2])
        })
      })

      describe('when sender is not an admin', () => {
        beforeEach(async () => {
          await messenger.dispatch({
            commandResult: { status: statuses.NOOP, message: messages.noop },
            dispatchable: { db, iface, channel, sender: subscriberSender, message: 'please help!' },
          })
        })

        it('does not broadcast a message', () => {
          expect(broadcastSpy.callCount).to.eql(0)
        })

        it('sends an error message to the message sender', () => {
          expect(sendMessageStub.getCall(0).args).to.eql([
            iface,
            messages.unauthorized,
            [subscriberSender.phoneNumber],
          ])
        })
      })
    })
  })

  describe('formatting messages', () => {
    describe('broadcast messages', () => {
      it('adds a prefix', () => {
        expect(messenger.format(channel, 'blah')).to.eql('[foobar]\nblah')
      })
    })
    describe('most commands', () => {
      it('adds a prefix', () => {
        expect(messenger.format(channel, 'blah', 'JOIN', 'SUCCESS')).to.eql('[foobar]\nblah')
      })
    })
    describe('when message is the response to a RENAME comand', () => {
      it('does not add a prefix', () => {
        expect(messenger.format(channel, 'blah', 'RENAME', 'SUCCESS')).to.eql('blah')
      })
    })
    describe('when the message is the response to an unauthorized command attempt', () => {
      it('does not add a prefix', () => {
        expect(messenger.format(channel, 'blah', 'INFO', 'UNAUTHORIZED')).to.eql('blah')
      })
    })
    describe('when there is no command but status is UNAUHTORIZED', () => {
      it('does not add a prefix', () => {
        expect(messenger.format(channel, 'blah', 'INFO', 'UNAUTHORIZED')).to.eql('blah')
      })
    })
  })
})
