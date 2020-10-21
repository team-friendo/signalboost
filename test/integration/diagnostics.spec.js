import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import app from '../../app'
import testApp from '../support/testApp'
import db from '../../app/db'
import { map, times } from 'lodash'
import socket from '../../app/socket/write'
import util from '../../app/util'
import signal from '../../app/signal'
import { channelFactory, deepChannelFactory } from '../support/factories/channel'
import { failedHealthchecks, sendHealthchecks } from '../../app/diagnostics'
import { messageTypes } from '../../app/signal/constants'

const {
  signal: { diagnosticsPhoneNumber, healthcheckTimeout },
} = require('../../app/config')

describe('diagnostics jobs', () => {
  const uuids = times(9, util.genUuid)
  let channels, diagnosticsChannel, writeStub, readSock

  const isNotHealthcheck = call =>
    !((call.args[0].messageBody || '').slice(0, 11) === 'healthcheck')

  const createChannels = async () => {
    channels = await Promise.all(times(4, () => app.db.channel.create(channelFactory())))
    diagnosticsChannel = await app.db.channel.create(
      deepChannelFactory({ phoneNumber: diagnosticsPhoneNumber }),
      {
        include: [{ model: app.db.membership }],
      },
    )
  }

  const destroyAllChannels = async () => {
    await app.db.membership.destroy({ where: {}, force: true })
    await app.db.messageCount.destroy({ where: {}, force: true })
    await app.db.hotlineMessage.destroy({
      where: {},
      force: true,
      truncate: true,
      restartIdentity: true,
    })
    await app.db.channel.destroy({ where: {}, force: true })
  }

  const echoBackToSocket = outSdMessage => {
    const inSdMessage = {
      type: messageTypes.MESSAGE,
      data: {
        username: outSdMessage.recipientAddress.number,
        source: { number: outSdMessage.username },
        dataMessage: {
          body: outSdMessage.messageBody,
          attachments: outSdMessage.attachments,
        },
      },
    }
    readSock.emit('data', JSON.stringify(inSdMessage))
  }

  before(async () => {
    await app.run({ ...testApp, db, signal })
  })

  after(async () => {
    await app.stop()
  })

  describe('healthcheck', () => {
    beforeEach(async () => {
      // await destroyAllChannels()
      await createChannels()
      readSock = await app.socketPools[0].acquire()
      const genUuidStub = sinon.stub(util, 'genUuid')
      uuids.forEach((uuid, idx) => genUuidStub.onCall(idx).returns(uuid))
    })
    afterEach(async () => {
      try {
        sinon.restore()
        await destroyAllChannels()
        await app.socketPools[0].release(readSock)
      } catch (ignored) {
        /**/
      }
    })

    describe('in a healthy state', () => {
      beforeEach(async () => {
        writeStub = sinon.stub(socket, 'write').callsFake(echoBackToSocket)
        await sendHealthchecks()
      })

      it('sends a a healthcheck to every channel and gets a response', () => {
        expect(writeStub.callCount).to.eql(2 * channels.length)
        expect(map(writeStub.getCalls(), 'args')).to.have.deep.members([
          ...channels.map((channel, idx) => [
            {
              messageBody: `healthcheck ${uuids[idx]}`,
              recipientAddress: { number: channels[idx].phoneNumber },
              type: messageTypes.SEND,
              username: diagnosticsPhoneNumber,
            },
            diagnosticsChannel.socketId,
          ]),
          ...channels.map((channel, idx) => [
            {
              messageBody: `healthcheck_response ${uuids[idx]}`,
              recipientAddress: { number: diagnosticsPhoneNumber },
              type: messageTypes.SEND,
              username: channels[idx].phoneNumber,
              attachments: [],
            },
            channel.socketId,
          ]),
        ])
      })
    })

    describe('when a healtcheck fails for the first time', () => {
      beforeEach(async () => {
        writeStub = sinon.stub(socket, 'write').returns(Promise.resolve(''))
        await sendHealthchecks()
        await util.wait(healthcheckTimeout)
      })

      it('does not alert maintainers', () => {
        expect(writeStub.callCount).to.eql(channels.length)
      })

      it('caches healthcheck failures', () => {
        expect(failedHealthchecks.size).to.eql(channels.length)
      })
    })

    describe('when a healtcheck fails twice in a row', () => {
      beforeEach(async function() {
        this.timeout(8000)
        writeStub = sinon.stub(socket, 'write').returns(Promise.resolve(''))
        await sendHealthchecks()
        await util.wait(healthcheckTimeout)
        await sendHealthchecks()
        await util.wait(1.5 * healthcheckTimeout)
      })

      it('notifies maintainers and restarts signalboost', async function() {
        // refetch socket ids b/c restart will trigger shard job which reassigns sockets
        const reshardedDiagnosticsChannelSocket = (await app.db.channel.findOne({
          where: { phoneNumber: diagnosticsPhoneNumber },
        })).socketId
        const reshardedChannelSockets = (await Promise.all(
          channels.map(({ phoneNumber }) => app.db.channel.findOne({ where: { phoneNumber } })),
        )).map(c => c.socketId)
        const numHealtchecks = 2 * channels.length
        const numRestartMessages = 21

        expect(writeStub.callCount).to.be.above(numHealtchecks + numRestartMessages)
        expect(
          map(
            writeStub
              .getCalls()
              .filter(isNotHealthcheck)
              .slice(0, -2), // omit timeout messages
            //.slice(numHealtchecks, numHealtchecks + numRestartMessages),
            'args',
          ),
        ).to.have.deep.members([
          [
            {
              messageBody: `Channel ${
                channels[0].phoneNumber
              } failed to respond to 2 consecutive healthchecks.`,
              recipientAddress: {
                number: diagnosticsChannel.memberships[0].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: `Channel ${
                channels[0].phoneNumber
              } failed to respond to 2 consecutive healthchecks.`,
              recipientAddress: {
                number: diagnosticsChannel.memberships[1].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: `Channel ${
                channels[1].phoneNumber
              } failed to respond to 2 consecutive healthchecks.`,
              recipientAddress: {
                number: diagnosticsChannel.memberships[0].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: `Channel ${
                channels[1].phoneNumber
              } failed to respond to 2 consecutive healthchecks.`,
              recipientAddress: {
                number: diagnosticsChannel.memberships[1].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: `Channel ${
                channels[2].phoneNumber
              } failed to respond to 2 consecutive healthchecks.`,
              recipientAddress: {
                number: diagnosticsChannel.memberships[0].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: `Channel ${
                channels[2].phoneNumber
              } failed to respond to 2 consecutive healthchecks.`,
              recipientAddress: {
                number: diagnosticsChannel.memberships[1].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: `Channel ${
                channels[3].phoneNumber
              } failed to respond to 2 consecutive healthchecks.`,
              recipientAddress: {
                number: diagnosticsChannel.memberships[0].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: `Channel ${
                channels[3].phoneNumber
              } failed to respond to 2 consecutive healthchecks.`,
              recipientAddress: {
                number: diagnosticsChannel.memberships[1].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: 'Restarting Signalboost due to failed healthchecks...',
              recipientAddress: {
                number: diagnosticsChannel.memberships[0].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              messageBody: 'Restarting Signalboost due to failed healthchecks...',
              recipientAddress: {
                number: diagnosticsChannel.memberships[1].memberPhoneNumber,
              },
              type: 'send',
              username: diagnosticsPhoneNumber,
              attachments: [],
            },
            diagnosticsChannel.socketId,
          ],
          [
            {
              type: 'abort',
            },
            reshardedDiagnosticsChannelSocket,
          ],
          [
            {
              type: 'abort',
            },
            reshardedChannelSockets[0],
          ],
          [
            {
              type: 'abort',
            },
            reshardedChannelSockets[1],
          ],
          [
            {
              type: 'abort',
            },
            reshardedChannelSockets[2],
          ],
          [
            {
              type: 'abort',
            },
            reshardedChannelSockets[3],
          ],
          [
            {
              type: 'subscribe',
              username: diagnosticsPhoneNumber,
            },
            reshardedDiagnosticsChannelSocket,
          ],
          [
            {
              type: 'subscribe',
              username: channels[0].phoneNumber,
            },
            reshardedChannelSockets[0],
          ],
          [
            {
              type: 'subscribe',
              username: channels[1].phoneNumber,
            },
            reshardedChannelSockets[1],
          ],
          [
            {
              type: 'subscribe',
              username: channels[2].phoneNumber,
            },
            reshardedChannelSockets[2],
          ],
          [
            {
              type: 'subscribe',
              username: channels[3].phoneNumber,
            },
            reshardedChannelSockets[3],
          ],
          [
            {
              type: 'version',
            },
            reshardedDiagnosticsChannelSocket,
          ],
          [
            {
              type: 'version',
            },
            reshardedChannelSockets[0],
          ],
          [
            {
              type: 'version',
            },
            reshardedChannelSockets[1],
          ],
          [
            {
              type: 'version',
            },
            reshardedChannelSockets[2],
          ],
          [
            {
              type: 'version',
            },
            reshardedChannelSockets[3],
          ],
        ])
      })
    })
  })
})
