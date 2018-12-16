import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import { dispatch, messages } from '../../app/service/dispatch'
import sinon from 'sinon'
import signalInterfaceService from '../../app/service/signalInterface'
import channelRepository from '../../app/service/repository/channel'

describe('dispatch service', () => {
  describe('processing messages', () => {
    let isAdminStub, getSubscriberNumbersStub, sendMessageStub
    const sender = '+10000000000'
    const subscriberNumbers = ['+11111111111', '+12222222222']

    beforeEach(() => {
      isAdminStub = sinon.stub(channelRepository, 'isAdmin')
      getSubscriberNumbersStub = sinon
        .stub(channelRepository, 'getSubscriberNumbers')
        .returns(Promise.resolve(subscriberNumbers))
      sendMessageStub = sinon.stub(signalInterfaceService, 'sendMessage')
    })

    afterEach(() => {
      isAdminStub.restore()
      getSubscriberNumbersStub.restore()
      sendMessageStub.restore()
    })

    describe('when sender is an admin', () => {
      beforeEach(() => {
        isAdminStub.returns(Promise.resolve(true))
      })

      it('relays the message to all channel subscribers', async () => {
        await dispatch({
          db: {},
          channelPhoneNumber: '',
          message: 'hello',
          sender,
          attachments: ['fake'],
        })

        expect(sendMessageStub.getCall(0).args).to.eql(['hello', subscriberNumbers, ['fake']])
      })
    })

    describe('when sender is not an admin', () => {
      beforeEach(() => {
        isAdminStub.returns(Promise.resolve(false))
      })

      it('relays the message to all channel subscribers', async () => {
        await dispatch({
          db: {},
          channelPhoneNumber: '',
          message: 'hello',
          sender,
          attachments: ['fake'],
        })

        expect(sendMessageStub.getCall(0).args).to.eql([
          messages.notAdmin,
          [sender],
        ])
      })
    })
  })
})
