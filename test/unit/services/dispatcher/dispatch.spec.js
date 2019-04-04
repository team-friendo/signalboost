import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { dispatch } from '../../../../app/services/dispatcher/run'
import commandService, { statuses, messages } from '../../../../app/services/dispatcher/command'
import messageService from '../../../../app/services/dispatcher/message'

describe('dispatcher service', () => {
  const iface = {}
  const sender = '+10000000000'
  const channelPhoneNumber = '+13333333333'

  describe('handling a message', () => {
    let parseCommandStub, executeStub, sendStub, maybeBroadcastStub

    beforeEach(() => {
      parseCommandStub = sinon.stub(commandService, 'parseCommand')
      executeStub = sinon.stub(commandService, 'execute')
      sendStub = sinon.stub(messageService, 'send')
      maybeBroadcastStub = sinon.stub(messageService, 'maybeBroadcast')
    })

    afterEach(() => {
      parseCommandStub.restore()
      executeStub.restore()
      sendStub.restore()
      maybeBroadcastStub.restore()
    })

    describe('in all cases', () => {
      beforeEach(async () => {
        parseCommandStub.returns({ command: 'foo', payload: 'bar' })
        executeStub.returns(Promise.resolve('baz'))
        await dispatch({ iface, channelPhoneNumber, sender, message: 'foobar' })
      })

      it('attempts to parse a command from the message', () => {
        expect(parseCommandStub.getCall(0).args[0]).to.eql('foobar')
      })

      it('executes the parsed command', () => {
        expect(executeStub.getCall(0).args[0]).to.eql({
          command: 'foo',
          payload: 'bar',
          iface,
          channelPhoneNumber,
          sender,
          message: 'foobar',
        })
      })
    })

    describe('when message contains a command that is executed', () => {
      beforeEach(async () => {
        executeStub.returns(
          Promise.resolve({ status: statuses.SUCCESS, message: messages.JOIN_SUCCESS }),
        )
        await dispatch({ iface, channelPhoneNumber, sender, message: 'JOIN' })
      })

      it('responds to the sender of the command', () => {
        expect(sendStub.getCall(0).args).to.have.members([iface, messages.JOIN_SUCCESS, sender])
      })

      it('does not attempt to broadcast a message', () => {
        expect(maybeBroadcastStub.callCount).to.eql(0)
      })
    })

    describe('when message does not contain a command', () => {
      beforeEach(async () => {
        executeStub.returns(Promise.resolve({ status: statuses.NOOP, message: messages.NOOP }))
        await dispatch({ iface, channelPhoneNumber, sender, message: 'foobar' })
      })

      it('does not respond to the sender', () => {
        expect(sendStub.callCount).to.eql(0)
      })

      it('attempts to broadcast the message', () => {
        expect(maybeBroadcastStub.getCall(0).args).to.have.deep.members([
          { iface, channelPhoneNumber, sender, message: 'foobar' },
        ])
      })
    })
  })
})