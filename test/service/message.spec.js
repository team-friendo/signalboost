import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../app/service/repository/channel'
import signalInterfaceService from '../../app/service/signalInterface'
import { messages, maybeBroadcast, send } from '../../app/service/dispatch/message'

describe('messages service', () => {
  const sender = '+10000000000'
  const subscriberNumbers = ['+11111111111', '+12222222222']
  const channelPhoneNumber = '+13333333333'
  let isAdminStub, getSubscriberNumbersStub, sendMessageStub

  beforeEach(() => {
    getSubscriberNumbersStub = sinon
      .stub(channelRepository, 'getSubscriberNumbers')
      .returns(Promise.resolve(subscriberNumbers))
    isAdminStub = sinon.stub(channelRepository, 'isAdmin')
    sendMessageStub = sinon.stub(signalInterfaceService, 'sendMessage')
  })

  afterEach(() => {
    isAdminStub.restore()
    getSubscriberNumbersStub.restore()
    sendMessageStub.restore()
  })

  describe('broadcasting a message', () => {
    describe('when sender is an admin', () => {
      beforeEach(() => isAdminStub.returns(Promise.resolve(true)))

      it('relays the message to all channel subscribers', async () => {
        await maybeBroadcast({
          db: {},
          channelPhoneNumber,
          message: 'hello',
          sender,
          attachments: ['fake'],
        })

        expect(sendMessageStub.getCall(0).args).to.eql(['hello', subscriberNumbers, ['fake']])
      })
    })

    describe('when sender is not an admin', () => {
      beforeEach(() => isAdminStub.returns(Promise.resolve(false)))

      it('sends a NOT_ADMIN message to the sender', async () => {
        await maybeBroadcast({
          db: {},
          channelPhoneNumber: '',
          message: 'hello',
          sender,
          attachments: ['fake'],
        })

        expect(sendMessageStub.getCall(0).args).to.have.deep.members([messages.NOT_ADMIN, [sender]])
      })
    })
  })

  describe('sending a message', () => {
    it('sends a message through the signal interface', async () => {
      await send('hello', subscriberNumbers[0])
      expect(sendMessageStub.getCall(0).args).to.have.deep.members([
        'hello',
        [subscriberNumbers[0]],
      ])
    })
  })
})
