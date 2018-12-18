import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { commands, statuses, messages, parseCommand, execute } from '../../app/service/command'
import channelRepository from '../../app/service/repository/channel'
import { subscriptionFactory } from '../support/factories/subscription'

describe('command service', () => {
  describe('parsing commands', () => {
    it('parses an ADD command', () => {
      expect(parseCommand('ADD')).to.eql(commands.ADD)
    })
    it('parses an ADD command regardless of case', () => {
      expect(parseCommand('add')).to.eql(commands.ADD)
    })
    it('parses an ADD command with whitespace', () => {
      expect(parseCommand(' add ')).to.eql(commands.ADD)
    })
    it('does not parse an ADD command when string contains characters other than `add`', () => {
      expect(parseCommand('please add ')).to.eql(null)
      expect(parseCommand('add me!')).to.eql(null)
      expect(parseCommand('join')).to.eql(null)
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

    describe('invalid command', () => {
      it('returns FAILURE status / INVALID message', async () => {
        expect(await execute('foobar', {})).to.eql({
          status: statuses.FAILURE,
          message: messages.INVALID,
        })
      })
    })
  })
})
