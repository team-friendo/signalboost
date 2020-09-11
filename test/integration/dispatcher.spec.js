import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import app from '../../app'
import testApp from '../support/testApp'
import db from '../../app/db'
import socket from '../../app/socket/write'
import signal from '../../app/signal'
import { channelFactory } from '../support/factories/channel'
import { times } from 'lodash'
import { wait } from '../../app/util'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../support/factories/membership'
import { genPhoneNumber } from '../support/factories/phoneNumber'
import { messagesIn } from '../../app/dispatcher/strings/messages'
import { languages } from '../../app/language'
import { hotlineMessageFactory } from '../support/factories/hotlineMessages'

describe('dispatcher service', () => {
  const socketDelay = 200
  const randoPhoneNumber = genPhoneNumber()
  let channel, admins, subscribers, writeStub, readSock

  const createChannelWithMembers = async () => {
    channel = await app.db.channel.create(channelFactory())
    admins = await Promise.all(
      times(2, () =>
        app.db.membership.create(
          adminMembershipFactory({ channelPhoneNumber: channel.phoneNumber }),
        ),
      ),
    )
    subscribers = await Promise.all(
      times(2, () =>
        app.db.membership.create(
          subscriberMembershipFactory({ channelPhoneNumber: channel.phoneNumber }),
        ),
      ),
    )
  }

  const enableHotlineMessages = () => channel.update({ hotlineOn: true })

  const createHotlineMessage = ({ id, memberPhoneNumber }) =>
    app.db.hotlineMessage.create(
      hotlineMessageFactory({
        id,
        memberPhoneNumber,
        channelPhoneNumber: channel.phoneNumber,
      }),
    )

  before(async () => await app.run({ ...testApp, db, signal }))
  beforeEach(async () => {
    readSock = await app.socketPool.acquire()
    writeStub = sinon.stub(socket, 'write').returns(Promise.resolve())
  })
  afterEach(async () => {
    await app.db.membership.destroy({ where: {}, force: true })
    await app.db.messageCount.destroy({ where: {}, force: true })
    await app.db.hotlineMessage.destroy({
      where: {},
      force: true,
      truncate: true,
      restartIdentity: true,
    })
    await app.db.channel.destroy({ where: {}, force: true })
    await app.socketPool.release(readSock)
    sinon.restore()
  })
  after(async () => await app.stop())

  describe('dispatching a broadcast message', () => {
    beforeEach(async () => {
      await createChannelWithMembers()
      readSock.emit(
        'data',
        JSON.stringify({
          type: 'message',
          data: {
            username: channel.phoneNumber,
            source: {
              number: admins[0].memberPhoneNumber,
            },
            dataMessage: {
              timestamp: new Date().toISOString(),
              body: 'foobar',
              expiresInSeconds: channel.messageExpiryTime,
              attachments: [],
            },
          },
        }),
      )
      // wait longer b/c we send broadcast messages in sequence
      await wait(4 * socketDelay)
    })

    it('relays the message to all admins and subscribers', () => {
      const messages = times(4, n => writeStub.getCall(n)).map(call => call.args[0])
      expect(messages).to.have.deep.members([
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[0].memberPhoneNumber },
          messageBody: `[BROADCAST]\nfoobar`,
          attachments: [],
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[1].memberPhoneNumber },
          messageBody: `[BROADCAST]\nfoobar`,
          attachments: [],
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: subscribers[0].memberPhoneNumber },
          messageBody: `[${channel.name}]\nfoobar`,
          attachments: [],
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: subscribers[1].memberPhoneNumber },
          messageBody: `[${channel.name}]\nfoobar`,
          attachments: [],
        },
      ])
    })
  })

  describe('dispatching a hotline message', () => {
    beforeEach(async () => {
      await createChannelWithMembers()
      await enableHotlineMessages()
      readSock.emit(
        'data',
        JSON.stringify({
          type: 'message',
          data: {
            username: channel.phoneNumber,
            source: { number: randoPhoneNumber },
            dataMessage: {
              timestamp: new Date().toISOString(),
              body: 'a screaming came across the sky',
              expiresInSeconds: channel.messageExpiryTime,
              attachments: [],
            },
          },
        }),
      )
      await wait(2 * socketDelay)
    })

    it('relays the hotline message to all admins', () => {
      const messages = times(2, n => writeStub.getCall(n)).map(c => c.args[0])
      expect(messages).to.have.deep.members([
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[0].memberPhoneNumber },
          messageBody: `[HOTLINE #1]\na screaming came across the sky`,
          attachments: [],
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[1].memberPhoneNumber },
          messageBody: `[HOTLINE #1]\na screaming came across the sky`,
          attachments: [],
        },
      ])
    })
  })

  describe('dispatching a HELLO command', () => {
    beforeEach(async () => {
      await createChannelWithMembers()
      readSock.emit(
        'data',
        JSON.stringify({
          type: 'message',
          data: {
            username: channel.phoneNumber,
            source: { number: randoPhoneNumber },
            dataMessage: {
              timestamp: new Date().toISOString(),
              body: 'HELLO',
              expiresInSeconds: channel.messageExpiryTime,
              attachments: [],
            },
          },
        }),
      )
      await wait(2 * socketDelay)
    })

    it('subscribes the sender to the channel', async () => {
      expect(
        await app.db.membership.findOne({
          where: {
            channelPhoneNumber: channel.phoneNumber,
            memberPhoneNumber: randoPhoneNumber,
          },
        }),
      ).not.to.eql(null)
    })

    it('sends a welcome message to the sender', () => {
      expect(writeStub.getCall(0).args[0]).to.eql({
        messageBody: messagesIn(languages.EN).commandResponses.join.success(channel),
        recipientAddress: { number: randoPhoneNumber },
        type: 'send',
        username: channel.phoneNumber,
      })
    })
  })

  describe('dispatching a REPLY command', () => {
    beforeEach(async () => {
      await createChannelWithMembers()
      await enableHotlineMessages()
      await createHotlineMessage({ id: 1, memberPhoneNumber: randoPhoneNumber })
      readSock.emit(
        'data',
        JSON.stringify({
          type: 'message',
          data: {
            username: channel.phoneNumber,
            source: { number: admins[0].memberPhoneNumber },
            dataMessage: {
              timestamp: new Date().toISOString(),
              body: 'REPLY #1 it has happened before but there is nothing to compare it to now',
              expiresInSeconds: channel.messageExpiryTime,
              attachments: [],
            },
          },
        }),
      )
      await wait(2 * socketDelay)
    })

    it('relays the hotline reply to hotline message sender and all admins', () => {
      const messages = times(3, n => writeStub.getCall(n)).map(c => c.args[0])
      expect(messages).to.have.deep.members([
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[0].memberPhoneNumber },
          messageBody: `[REPLY TO HOTLINE #1]\nit has happened before but there is nothing to compare it to now`,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[1].memberPhoneNumber },
          messageBody: `[REPLY TO HOTLINE #1]\nit has happened before but there is nothing to compare it to now`,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: randoPhoneNumber },
          messageBody: `[PRIVATE REPLY FROM ADMINS]\nit has happened before but there is nothing to compare it to now`,
        },
      ])
    })
  })
})
