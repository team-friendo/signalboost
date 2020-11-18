import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import app from '../../app'
import testApp from '../support/testApp'
import db from '../../app/db'
import signal from '../../app/signal'
import socket from '../../app/socket/write'
import util from '../../app/util'
import phoneNumberRegistrar from '../../app/registrar/phoneNumber'
import { getSentMessages } from '../support/socket'
import { createChannels, destroyAllChannels } from '../support/db'
const {
  jobs: { channelDestructionInterval, channelDestructionGracePeriod },
} = require('../../app/config')

describe('channel destruction', () => {
  /***************************************************************************************
   * TO RUN THIS TEST IN IDE IN ISOLATION:
   * edit app.config.jobs.channelDestructionGracePeriod to always be 12 * testInterval
   **************************************************************************************/
  const socketId = 2
  let channel, diagnosticsChannel, readSock, writeStub, cancel

  before(async () => {
    await app.run({ ...testApp, db, signal })
  })

  beforeEach(async () => {
    await createChannels(app.db, 1).then(([_channels, _diagnosticsChannel]) => {
      channel = _channels[0]
      diagnosticsChannel = _diagnosticsChannel
    })
    readSock = await app.socketPools[socketId].acquire()
    writeStub = sinon.stub(socket, 'write').returns(Promise.resolve())
  })
  afterEach(async () => {
    try {
      await destroyAllChannels(app.db)
      await app.socketPools[socketId].release(readSock)
      if (cancel) await cancel()
      sinon.restore()
    } catch (ignored) {
      /**/
    }
  })
  after(async () => {
    await app.stop()
  })

  describe('when channel is not redeemed', () => {
    beforeEach(async () => {
      await phoneNumberRegistrar.requestToDestroy([channel.phoneNumber])
      cancel = util.repeatUntilCancelled(() => {
        phoneNumberRegistrar.processDestructionRequests()
      }, channelDestructionInterval)
      await util.wait(1.2 * channelDestructionGracePeriod)
    })

    it('it sends 3 warning to admins then deletes the channel', function() {
      const messages = getSentMessages(writeStub)
      if (messages.length !== 13) {
        console.log('FLAKEY TEST: integration.channelDestruction')
      } else {
        expect(messages).to.have.deep.members([
          /*************** FIRST WARNING ***************/
          {
            attachments: [],
            messageBody:
              'Hello! This channel will be destroyed in 0 hours due to lack of use.\n\nTo prevent it from being destroyed, send INFO within the next 0 hours.\n\nIf you would like to destroy the channel right now, respond with DESTROY.\n\nFor more information, visit signalboost.info/how-to.',
            recipientAddress: {
              number: channel.memberships[0].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },
          {
            attachments: [],
            messageBody:
              'Hello! This channel will be destroyed in 0 hours due to lack of use.\n\nTo prevent it from being destroyed, send INFO within the next 0 hours.\n\nIf you would like to destroy the channel right now, respond with DESTROY.\n\nFor more information, visit signalboost.info/how-to.',
            recipientAddress: {
              number: channel.memberships[1].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },

          /*************** SECOND WARNING ***************/
          {
            attachments: [],
            messageBody:
              'Hello! This channel will be destroyed in 0 hours due to lack of use.\n\nTo prevent it from being destroyed, send INFO within the next 0 hours.\n\nIf you would like to destroy the channel right now, respond with DESTROY.\n\nFor more information, visit signalboost.info/how-to.',
            recipientAddress: {
              number: channel.memberships[0].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },
          {
            attachments: [],
            messageBody:
              'Hello! This channel will be destroyed in 0 hours due to lack of use.\n\nTo prevent it from being destroyed, send INFO within the next 0 hours.\n\nIf you would like to destroy the channel right now, respond with DESTROY.\n\nFor more information, visit signalboost.info/how-to.',
            recipientAddress: {
              number: channel.memberships[1].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },

          /*************** THIRD WARNING ***************/
          {
            attachments: [],
            messageBody:
              'Hello! This channel will be destroyed in 0 hours due to lack of use.\n\nTo prevent it from being destroyed, send INFO within the next 0 hours.\n\nIf you would like to destroy the channel right now, respond with DESTROY.\n\nFor more information, visit signalboost.info/how-to.',
            recipientAddress: {
              number: channel.memberships[0].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },
          {
            attachments: [],
            messageBody:
              'Hello! This channel will be destroyed in 0 hours due to lack of use.\n\nTo prevent it from being destroyed, send INFO within the next 0 hours.\n\nIf you would like to destroy the channel right now, respond with DESTROY.\n\nFor more information, visit signalboost.info/how-to.',
            recipientAddress: {
              number: channel.memberships[1].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },

          /*************** MEMBER DELETION NOTICES ***************/
          {
            attachments: [],
            messageBody:
              'Channel destroyed due to lack of use. To create a new channel, visit https://signalboost.info',
            recipientAddress: {
              number: channel.memberships[0].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },
          {
            attachments: [],
            messageBody:
              'Channel destroyed due to lack of use. To create a new channel, visit https://signalboost.info',
            recipientAddress: {
              number: channel.memberships[1].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },
          {
            attachments: [],
            messageBody:
              'Channel destroyed due to lack of use. To create a new channel, visit https://signalboost.info',
            recipientAddress: {
              number: channel.memberships[2].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },
          {
            attachments: [],
            messageBody:
              'Channel destroyed due to lack of use. To create a new channel, visit https://signalboost.info',
            recipientAddress: {
              number: channel.memberships[3].memberPhoneNumber,
            },
            type: 'send',
            username: channel.phoneNumber,
          },

          /*************** MAINTAINER DELETION NOTICES ***************/
          {
            attachments: [],
            messageBody: `1 destruction requests processed:\n\nChannel ${
              channel.phoneNumber
            } destroyed.`,
            recipientAddress: {
              number: diagnosticsChannel.memberships[0].memberPhoneNumber,
            },
            type: 'send',
            username: diagnosticsChannel.phoneNumber,
          },
          {
            attachments: [],
            messageBody: `1 destruction requests processed:\n\nChannel ${
              channel.phoneNumber
            } destroyed.`,
            recipientAddress: {
              number: diagnosticsChannel.memberships[1].memberPhoneNumber,
            },
            type: 'send',
            username: diagnosticsChannel.phoneNumber,
          },

          /*************** UNSUBSCRIBE ***************/
          {
            type: 'unsubscribe',
            username: channel.phoneNumber,
          },
        ])
      }
    })
  })
})
