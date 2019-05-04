import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import run from '../../../../app/services/dispatcher/run'
import channelRepository from '../../../../app/db/repositories/channel'
import signal from '../../../../app/services/signal'
import executor from '../../../../app/services/dispatcher/executor'
import messenger from '../../../../app/services/dispatcher/messenger'
import { channelFactory } from '../../../support/factories/channel'
import { channelPhoneNumber } from '../../../../app/config'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('dispatcher service', () => {
  describe('running the service', () => {
    const [db, iface] = [{}, {}]
    const channel = { ...channelFactory(), publications: [], subscriptions: [] }
    const sender = genPhoneNumber()
    const unwelcomedPublishers = [genPhoneNumber(), genPhoneNumber()]
    const authenticatedSender = {
      phoneNumber: sender,
      isPublisher: true,
      isSubscriber: true,
    }

    let getDbusStub,
      getUnwelcomedPublishersStub,
      welcomeNewPublisherStub,
      onReceivedMessageStub,
      findDeepStub,
      isPublisherStub,
      isSubscriberStub,
      processCommandStub,
      dispatchStub

    beforeEach(async () => {
      // main loop stubs --v
      getDbusStub = sinon.stub(signal, 'getDbusInterface').returns(Promise.resolve(iface))

      getUnwelcomedPublishersStub = sinon
        .stub(channelRepository, 'getUnwelcomedPublishers')
        .returns(unwelcomedPublishers)

      welcomeNewPublisherStub = sinon.stub(messenger, 'welcomeNewPublisher').returns(Promise.resolve())

      // main loop stubs --^

      // onReceivedMessage stubs --v

      onReceivedMessageStub = sinon
        .stub(signal, 'onReceivedMessage')
        .callsFake(() => fn => fn({ sender, message: 'foo' }))

      findDeepStub = sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channel))

      isPublisherStub = sinon.stub(channelRepository, 'isPublisher').returns(Promise.resolve(true))

      isSubscriberStub = sinon
        .stub(channelRepository, 'isSubscriber')
        .returns(Promise.resolve(true))

      processCommandStub = sinon.stub(executor, 'processCommand').returns(
        Promise.resolve({
          commandResult: { command: 'NOOP', status: 'SUCCESS', message: 'foo' },
          dispatchable: { db, iface, channel, sender: authenticatedSender, message: 'foo' },
        }),
      )

      dispatchStub = sinon.stub(messenger, 'dispatch').returns(Promise.resolve())
      // onReceivedMessage stubs --^

      await run(db)
    })

    afterEach(() => {
      getDbusStub.restore()
      getUnwelcomedPublishersStub.restore()
      welcomeNewPublisherStub.restore()
      onReceivedMessageStub.restore()
      findDeepStub.restore()
      isPublisherStub.restore()
      isSubscriberStub.restore()
      processCommandStub.restore()
      dispatchStub.restore()
    })

    it('retrieves a dbus interface', () => {
      expect(onReceivedMessageStub.callCount).to.eql(1)
    })

    it('it sends a welcome message to every unwelcomed publisher', () => {
      unwelcomedPublishers.forEach((newPublisher, i) => {
        expect(welcomeNewPublisherStub.getCall(i).args[0]).to.eql({
          db,
          iface,
          channel,
          newPublisher,
          addingPublisher: 'the system administrator',
        })
      })
    })

    describe('for each incoming message', () => {
      it('retrieves a channel record', () => {
        expect(findDeepStub.getCall(0).args).to.eql([db, channelPhoneNumber])
      })

      it('retrieves permissions for the message sender', () => {
        expect(isPublisherStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        expect(isSubscriberStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
      })

      it('processes any commands in the message', () => {
        expect(processCommandStub.getCall(0).args[0]).to.eql({
          db,
          iface,
          channel,
          message: 'foo',
          sender: authenticatedSender,
        })
      })

      it('passes the command result and original message to messenger for dispatch', () => {
        expect(dispatchStub.getCall(0).args[0]).to.eql({
          commandResult: { command: 'NOOP', status: 'SUCCESS', message: 'foo' },
          dispatchable: { db, iface, channel, message: 'foo', sender: authenticatedSender },
        })
      })
    })
  })
})
