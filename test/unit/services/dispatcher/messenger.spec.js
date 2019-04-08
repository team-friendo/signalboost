import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../../../app/db/repositories/channel'
import signal from '../../../../app/services/dispatcher/signal'
import { statuses, commands } from '../../../../app/services/dispatcher/executor'
import messenger from '../../../../app/services/dispatcher/messenger'
import messages from '../../../../app/services/dispatcher/messages'

describe('messenger service', () => {
  const [db, iface] = [{}, {}]
  const channel = { name: 'foobar', phoneNumber: '+13333333333' }
  const subscriberNumbers = ['+11111111111', '+12222222222']
  const attachments = 'some/path'
  const message = 'please help!'
  const adminSender = {
    phoneNumber: '+10000000000',
    isAdmin: true,
    isSubscriber: true,
  }
  const subscriberSender = {
    phoneNumber: '+20000000000',
    isAdmin: false,
    isSubscriber: true,
  }
  let broadcastSpy, respondSpy, sendMessageStub, getSubscriberNumbersStub

  beforeEach(() => {
    broadcastSpy = sinon.spy(messenger, 'broadcast')
    respondSpy = sinon.spy(messenger, 'respond')
    sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve())
    getSubscriberNumbersStub = sinon
      .stub(channelRepository, 'getSubscriberNumbers')
      .returns(Promise.resolve(subscriberNumbers))
  })

  afterEach(() => {
    broadcastSpy.restore()
    respondSpy.restore()
    sendMessageStub.restore()
    getSubscriberNumbersStub.restore()
  })

  describe('dispatching a message', () => {
    describe('when message is a command that was executed', () => {
      beforeEach(async () => {
        await messenger.dispatch(
          { status: statuses.SUCCESS, message: 'yay you joined!' },
          { db, iface, channel, sender: adminSender, message: commands.JOIN },
        )
      })

      it('does not broadcast a message', () => {
        expect(broadcastSpy.callCount).to.eql(0)
      })

      it('sends a command result to the message sender', () => {
        expect(sendMessageStub.getCall(0).args).to.eql([
          iface,
          '[foobar]\nyay you joined!',
          [adminSender.phoneNumber],
        ])
      })
    })

    describe('when message is a broadcast message', () => {
      describe('when sender is an admin', () => {
        beforeEach(
          async () =>
            await messenger.dispatch(
              { status: statuses.NOOP, message: messages.noop },
              { db, iface, channel, sender: adminSender, message, attachments },
            ),
        )
        it('does not respond to the sender', () => {
          expect(respondSpy.callCount).to.eql(0)
        })

        it('broadcasts the message to all channel subscribers', () => {
          expect(sendMessageStub.getCall(0).args).to.eql([
            iface,
            '[foobar]\nplease help!',
            subscriberNumbers,
            'some/path',
          ])
        })
      })

      describe('when sender is not an admin', () => {
        beforeEach(async () => {
          await messenger.dispatch(
            { status: statuses.NOOP, message: messages.noop },
            { db, iface, channel, sender: subscriberSender, message: 'please help!' },
          )
        })

        it('does not broadcast a message', () => {
          expect(broadcastSpy.callCount).to.eql(0)
        })

        it('sends an error message to the message sender', () => {
          expect(sendMessageStub.getCall(0).args).to.eql([
            iface,
            messenger.prefix(channel, messages.notAdmin),
            [subscriberSender.phoneNumber],
          ])
        })
      })
    })
  })

  describe('helpers', () => {
    describe('#prefix', () => {
      describe('when message starts with [NOPREFIX] flag', () => {
        it('does not prefix the message and erases the flag', () => {
          expect(messenger.prefix(channel, '[NOPREFIX]hello world')).to.eql('hello world')
        })
      })
      describe('when message does not have a flag', () => {
        it('prefixes message with channel name', () => {
          expect(messenger.prefix(channel, 'hello world')).to.eql('[foobar]\nhello world')
        })
      })
    })
  })
})
