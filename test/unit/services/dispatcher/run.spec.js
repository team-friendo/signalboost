import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { EventEmitter } from 'events'
import { senderTypes, languages } from '../../../../app/constants'
import { run } from '../../../../app/services/dispatcher/run'
import channelRepository from '../../../../app/db/repositories/channel'
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
      language: languages.EN,
      type: senderTypes.PUBLISHER,
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

    let findAllDeepStub,
      findDeepStub,
      resolveSenderTypeStub,
      resolveSenderLanguageStub,
      subscribeStub,
      processCommandStub,
      dispatchStub

    beforeEach(async () => {
      // initialization stubs --v

      findAllDeepStub = sinon
        .stub(channelRepository, 'findAllDeep')
        .returns(Promise.resolve(channels))

      subscribeStub = sinon.stub(signal, 'subscribe').returns(Promise.resolve())

      // main loop stubs --^

      // on inboundMessage stubs --v

      findDeepStub = sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channels[0]))

      resolveSenderTypeStub = sinon
        .stub(channelRepository, 'resolveSenderType')
        .returns(Promise.resolve(senderTypes.PUBLISHER))

      resolveSenderLanguageStub = sinon
        .stub(channelRepository, 'resolveSenderLanguage')
        .returns(languages.EN)

      processCommandStub = sinon
        .stub(executor, 'processCommand')
        .returns(Promise.resolve({ command: 'NOOP', status: 'SUCCESS', message: 'foo' }))

      dispatchStub = sinon.stub(messenger, 'dispatch').returns(Promise.resolve())
      // onReceivedMessage stubs --^

      await run(db, sock)
      sock.emit('data', JSON.stringify(sdMessageOf(channel, 'foo')))
    })

    afterEach(() => {
      findAllDeepStub.restore()
      findDeepStub.restore()
      resolveSenderTypeStub.restore()
      resolveSenderLanguageStub.restore()
      processCommandStub.restore()
      dispatchStub.restore()
      subscribeStub.restore()
    })

    describe('handling an incoming message', () => {
      describe('when message is not relayable or a failed send attempt', () => {
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
          expect(resolveSenderTypeStub.getCall(0).args).to.eql([db, channel.phoneNumber, sender])
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
      //TODO: IMPLEMENT THESE UNIT TESTS NEXT TIME WE TOUCH THIS CODE!!!
      describe('when message is a failed send attempt', () => {
        it("attempts to trust the sender's safety number and re-send the message")
        describe('when message sending fails', () => {
          it('logs the error')
        })
      })

      describe('when message is a rate limit notification', () => {
        it('ignores the message')
      })
    })
  })
})
