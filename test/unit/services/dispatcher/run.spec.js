import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import run from '../../../../app/services/dispatcher/run'
import channelRepository from '../../../../app/db/repositories/channel'
import signal from '../../../../app/services/dispatcher/signal'
import executor from '../../../../app/services/dispatcher/executor'
import messenger from '../../../../app/services/dispatcher/messenger'
import { channelFactory } from '../../../support/factories/channel'
import { channelPhoneNumber } from '../../../../app/config'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('dispatcher service', () => {
  describe('running the service', () => {
    const [db, iface] = [{}, {}]
    const channel = channelFactory()
    const sender = genPhoneNumber()
    let getDbusStub,
      onReceivedMessageStub,
      findByPhoneNumberStub,
      isAdminStub,
      isSubscriberStub,
      processCommandStub,
      dispatchStub

    beforeEach(async () => {
      getDbusStub = sinon.stub(signal, 'getDbusInterface').returns(Promise.resolve(iface))

      onReceivedMessageStub = sinon
        .stub(signal, 'onReceivedMessage')
        .callsFake(() => fn => fn({ sender }))

      findByPhoneNumberStub = sinon
        .stub(channelRepository, 'findByPhoneNumber')
        .returns(Promise.resolve(channel))

      isAdminStub = sinon.stub(channelRepository, 'isAdmin').returns(Promise.resolve(true))

      isSubscriberStub = sinon
        .stub(channelRepository, 'isSubscriber')
        .returns(Promise.resolve(true))

      processCommandStub = sinon
        .stub(executor, 'processCommand')
        .returns(Promise.resolve({ status: 'SUCCESS', message: 'NOOP' }))

      dispatchStub = sinon.stub(messenger, 'dispatch').returns(Promise.resolve())

      await run(db)
    })

    afterEach(() => {
      getDbusStub.restore()
      onReceivedMessageStub.restore()
      findByPhoneNumberStub.restore()
      isAdminStub.restore()
      isSubscriberStub.restore()
      processCommandStub.restore()
      dispatchStub.restore()
    })

    it('retrieves a dbus interface', () => {
      expect(onReceivedMessageStub.callCount).to.eql(1)
    })

    describe('for each incoming message', () => {
      it('retrieves a channel record', () => {
        expect(findByPhoneNumberStub.getCall(0).args).to.eql([db, channelPhoneNumber])
      })

      it('retrieves permissions for the message sender', () => {
        expect(isAdminStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        expect(isSubscriberStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
      })

      it('processes any commands in the message', () => {
        expect(processCommandStub.getCall(0).args[0]).to.eql({
          db,
          iface,
          channel,
          sender: { phoneNumber: sender, isAdmin: true, isSubscriber: true },
        })
      })

      it('passes the command result and original message to messenger for dispatch', () => {
        expect(dispatchStub.getCall(0).args).to.eql([
          { status: 'SUCCESS', message: 'NOOP' },
          {
            db,
            iface,
            channel,
            sender: { phoneNumber: sender, isAdmin: true, isSubscriber: true },
          },
        ])
      })
    })
  })
})
