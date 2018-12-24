import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import {
  commands,
  statuses,
  messages,
  parseCommand,
  execute,
} from '../../app/service/dispatch/command'
import channelRepository from '../../app/service/repository/channel'
import { subscriptionFactory } from '../support/factories/subscription'
import { phoneNumberFactory } from '../support/factories/phoneNumber'

describe('command service', () => {
  describe('parsing commands', () => {
    it('parses an ADD command (regardless of case or whitespace)', () => {
      expect(parseCommand('ADD')).to.eql(commands.ADD)
      expect(parseCommand('add')).to.eql(commands.ADD)
      expect(parseCommand(' add ')).to.eql(commands.ADD)
    })

    it('does not parse an ADD command when string contains characters other than `add`', () => {
      expect(parseCommand('please add ')).to.eql(commands.NOOP)
      expect(parseCommand('add me!')).to.eql(commands.NOOP)
      expect(parseCommand('join')).to.eql(commands.NOOP)
    })

    it('parses a LEAVE command regardless of case or whitespace', () => {
      expect(parseCommand('LEAVE')).to.eql(commands.LEAVE)
      expect(parseCommand('leave')).to.eql(commands.LEAVE)
      expect(parseCommand(' leave ')).to.eql(commands.LEAVE)
    })
    it('does not parse a LEAVE command when string contains characters other than `leave`', () => {
      expect(parseCommand('i wanna leave ')).to.eql(commands.NOOP)
      expect(parseCommand('leave now!')).to.eql(commands.NOOP)
      expect(parseCommand('foobar')).to.eql(commands.NOOP)
    })
  })

  describe('executing commands', () => {
    describe('ADD command', () => {
      let isSubscriberStub, addSubscriberStub

      beforeEach(() => {
        isSubscriberStub = sinon.stub(channelRepository, 'isSubscriber')
        addSubscriberStub = sinon.stub(channelRepository, 'addSubscriber')
      })

      afterEach(() => {
        isSubscriberStub.restore()
        addSubscriberStub.restore()
      })

      describe('when number is not subscribed to channel', () => {
        beforeEach(() => {
          isSubscriberStub.returns(Promise.resolve(false))
        })

        describe('when adding subscriber succeeds', () => {
          beforeEach(() => {
            addSubscriberStub.returns(Promise.resolve(subscriptionFactory()))
          })

          it('returns SUCCESS status/message', async () => {
            expect(await execute(commands.ADD, {})).to.eql({
              status: statuses.SUCCESS,
              message: messages.ADD_SUCCESS,
            })
          })
        })

        describe('when adding subscriber fails', () => {
          beforeEach(() => {
            addSubscriberStub.callsFake(() => Promise.reject('foo'))
          })

          it('returns FAILURE status/message', async () => {
            expect(await execute(commands.ADD, {})).to.eql({
              status: statuses.FAILURE,
              message: messages.ADD_FAILURE,
            })
          })
        })
      })

      describe('when number is subscribed to channel', () => {
        let result
        beforeEach(async () => {
          isSubscriberStub.returns(Promise.resolve(true))
          result = await execute(commands.ADD, {})
        })
        it('does not try to add subscriber', () => {
          expect(addSubscriberStub.callCount).to.eql(0)
        })
        it('returns SUCCESS status / NOOP message', () => {
          expect(result).to.eql({
            status: statuses.SUCCESS,
            message: messages.ADD_NOOP,
          })
        })
      })
    })

    describe('LEAVE command', () => {
      const db = {}
      const [channelPhoneNumber, sender] = times(2, phoneNumberFactory)
      let isSubscriberStub, removeSubscriberStub

      beforeEach(() => {
        isSubscriberStub = sinon.stub(channelRepository, 'isSubscriber')
        removeSubscriberStub = sinon.stub(channelRepository, 'removeSubscriber')
      })

      afterEach(() => {
        isSubscriberStub.restore()
        removeSubscriberStub.restore()
      })

      describe('in all cases', () => {
        it('checks to see if sender is subscribed to channel', async () => {
          await execute(commands.LEAVE, { db, channelPhoneNumber, sender })
          expect(isSubscriberStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })
      })

      describe('when sender is subscribed to channel', () => {
        beforeEach(() => {
          isSubscriberStub.returns(Promise.resolve(true))
          removeSubscriberStub.returns(Promise.resolve())
        })

        it('attempts to remove subscriber', async () => {
          await execute(commands.LEAVE, { db, channelPhoneNumber, sender })
          expect(removeSubscriberStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })

        describe('when removing subscriber succeeds', () => {
          beforeEach(() => removeSubscriberStub.returns(Promise.resolve(1)))

          it('returns SUCCESS status/message', async () => {
            expect(await execute(commands.LEAVE, {})).to.eql({
              status: statuses.SUCCESS,
              message: messages.LEAVE_SUCCESS,
            })
          })
        })
        describe('when removing subscriber fails', () => {
          beforeEach(() => removeSubscriberStub.callsFake(() => Promise.reject('boom!')))

          it('returns FAILURE status/message', async () => {
            expect(await execute(commands.LEAVE, {})).to.eql({
              status: statuses.FAILURE,
              message: messages.LEAVE_FAILURE,
            })
          })
        })
      })

      describe('when human is not subscribed to channel', () => {
        let result
        beforeEach(async () => {
          isSubscriberStub.returns(Promise.resolve(false))
          result = await execute(commands.LEAVE, {})
        })

        it('does not try to remove subscriber', () => {
          expect(removeSubscriberStub.callCount).to.eql(0)
        })
        it('returns SUCCESS status / NOOP message', () => {
          expect(result).to.eql({
            status: statuses.SUCCESS,
            message: messages.LEAVE_NOOP,
          })
        })
      })
    })

    describe('invalid command', () => {
      it('returns NOOP status/message', async () => {
        expect(await execute('foobar', {})).to.eql({
          status: statuses.NOOP,
          message: messages.INVALID,
        })
      })
    })
  })
})
