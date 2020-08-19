import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import app from '../../app'
import testApp from '../support/testApp'
import db from '../../app/db'
import { times } from 'lodash'
import socket from '../../app/socket/write'
import util from '../../app/util'
import signal from '../../app/signal'
import { channelFactory } from '../support/factories/channel'
import { sendHealthchecks } from '../../app/diagnostics'
import { messageTypes } from '../../app/signal/constants'
const {
  signal: { diagnosticsPhoneNumber },
} = require('../../app/config')

describe('diagnostics jobs', () => {
  const uuids = times(3, util.genUuid)
  let channels, writeStub, readSock
  const createChannels = async () => {
    channels = await Promise.all(times(3, () => app.db.channel.create(channelFactory())))
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

  const writeToReadSock = outSdMessage => {
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

  before(async () => await app.run({ ...testApp, db, signal }))
  after(async () => await app.stop())

  describe('healthcheck', () => {
    beforeEach(async () => {
      await destroyAllChannels()
      await createChannels()
      readSock = await app.socketPool.acquire()
      writeStub = sinon.stub(socket, 'write').callsFake(writeToReadSock)
      const genUuidStub = sinon.stub(util, 'genUuid')
      uuids.forEach((uuid, idx) => genUuidStub.onCall(idx).returns(uuid))
      //
      await sendHealthchecks()
    })
    afterEach(async () => {
      await destroyAllChannels()
      await app.socketPool.release(readSock)
      sinon.restore()
    })

    it('sends a a healthcheck to every channel and gets a response', () => {
      const messages = times(2 * channels.length, n => writeStub.getCall(n).args[0])
      expect(messages).to.have.deep.members([
        ...channels.map((channel, idx) => ({
          messageBody: `healthcheck ${uuids[idx]}`,
          recipientAddress: { number: channels[idx].phoneNumber },
          type: messageTypes.SEND,
          username: diagnosticsPhoneNumber,
        })),
        ...channels.map((channel, idx) => ({
          messageBody: `healthcheck_response ${uuids[idx]}`,
          recipientAddress: { number: diagnosticsPhoneNumber },
          type: messageTypes.SEND,
          username: channels[idx].phoneNumber,
        })),
      ])
    })
  })
})
