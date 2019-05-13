import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { EventEmitter } from 'events'
import { run } from '../../../../app/services/dispatcher/run'
import channelRepository from '../../../../app/db/repositories/channel'
import phoneNumberService from '../../../../app/services/registrar/phoneNumber'
import signal from '../../../../app/services/signal'
import executor from '../../../../app/services/dispatcher/executor'
import messenger, { sdMessageOf } from '../../../../app/services/dispatcher/messenger'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { wait } from '../../../../app/services/util'

describe('dispatcher service', () => {
  describe('running the service', () => {
    const db = {}
    const sock = new EventEmitter()
    const channels = times(2, () => ({ ...channelFactory(), publications: [], subscriptions: [] }))
    const channel = channels[0]
    const sender = genPhoneNumber()
    const authenticatedSender = {
      phoneNumber: sender,
      isPublisher: true,
      isSubscriber: true,
    }
    const sdInMessage = {
      type: 'message',
      data: {
        username: channel.phoneNumber,
        source: sender,
        dataMessage: {
          timestamp: new Date().getTime(),
          message: 'foo',
          expiresInSeconds: 0,
          attachments: [],
        },
      },
    }
    const sdOutMessage = signal.parseOutboundSdMessage(sdInMessage)

    let getDbConnectionStub,
      getSocketStub,
      registerAllStub,
      findAllDeepStub,
      findDeepStub,
      isPublisherStub,
      isSubscriberStub,
      subscribeStub,
      processCommandStub,
      dispatchStub

    beforeEach(async () => {
      // initialization stubs --v
      // TODO: restore these when services are compartmentalized again
      // getDbConnectionStub = sinon.stub(dbWrapper, 'getDbConnection').returns(Promise.resolve())
      // getSocketStub = sinon.stub(signal, 'getSocket').returns(Promise.resolve(sock))

      registerAllStub = sinon
        .stub(phoneNumberService, 'registerAllUnregistered')
        .returns(Promise.resolve([]))

      findAllDeepStub = sinon
        .stub(channelRepository, 'findAllDeep')
        .returns(Promise.resolve(channels))

      subscribeStub = sinon.stub(signal, 'subscribe').returns(Promise.resolve())

      // main loop stubs --^

      // on inboundMessage stubs --v

      findDeepStub = sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channels[0]))

      isPublisherStub = sinon.stub(channelRepository, 'isPublisher').returns(Promise.resolve(true))

      isSubscriberStub = sinon
        .stub(channelRepository, 'isSubscriber')
        .returns(Promise.resolve(true))

      processCommandStub = sinon.stub(executor, 'processCommand').returns(
        Promise.resolve({
          commandResult: { command: 'NOOP', status: 'SUCCESS', message: 'foo' },
          dispatchable: { db, sock, channel, sender: authenticatedSender, sdMessage: sdOutMessage },
        }),
      )

      dispatchStub = sinon.stub(messenger, 'dispatch').returns(Promise.resolve())
      // onReceivedMessage stubs --^

      await run(db, sock)
      sock.emit('data', JSON.stringify(sdMessageOf(channel, 'foo')))
    })

    afterEach(() => {
      // getDbConnectionStub.restore()
      // getSocketStub.restore()
      findAllDeepStub.restore()
      findDeepStub.restore()
      isPublisherStub.restore()
      isSubscriberStub.restore()
      processCommandStub.restore()
      dispatchStub.restore()
      registerAllStub.restore()
      subscribeStub.restore()
    })

    // describe('initializing the service', () => {
    //   it('gets a signald socket connection', () => {
    //     expect(getSocketStub.callCount).to.eql(1)
    //   })
    //   it('gets a database connection', () => {
    //     expect(getDbConnectionStub.callCount).to.eql(1)
    //   })
    // })

    describe('handling an incoming message', () => {
      describe('when message is not dispatchable', () => {
        beforeEach(() => {
          sock.emit(
            'data',
            JSON.stringify({ type: 'message', data: { receipt: { type: 'READ' } } }),
          )
        })

        it('ignores the message', () => {
          expect(processCommandStub.callCount).to.eql(0)
          expect(dispatchStub.callCount).to.eql(0)
        })
      })

      describe('when message is dispatchable', () => {
        beforeEach(async () => {
          sock.emit('data', JSON.stringify(sdInMessage))
          await wait(10)
        })

        it('retrieves a channel record', () => {
          expect(findDeepStub.getCall(0).args).to.eql([db, channel.phoneNumber])
        })

        it('retrieves permissions for the message sender', () => {
          expect(isPublisherStub.getCall(0).args).to.eql([db, channel.phoneNumber, sender])
          expect(isSubscriberStub.getCall(0).args).to.eql([db, channel.phoneNumber, sender])
        })

        it('processes any commands in the message', () => {
          expect(processCommandStub.getCall(0).args[0]).to.eql({
            db,
            sock,
            channel,
            sender: authenticatedSender,
            sdMessage: sdOutMessage,
          })
        })

        it('passes the command result and original message to messenger for dispatch', () => {
          expect(dispatchStub.getCall(0).args[0]).to.eql({
            commandResult: { command: 'NOOP', status: 'SUCCESS', message: 'foo' },
            dispatchable: {
              db,
              sock,
              channel,
              sender: authenticatedSender,
              sdMessage: sdOutMessage,
            },
          })
        })
      })
    })
  })
})
