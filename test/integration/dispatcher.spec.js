import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
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
import { getSentMessages } from '../support/socket'
import { destroyAllChannels } from '../support/db'

describe('dispatcher service', () => {
  const socketId = 1
  const socketDelay = 400
  const randoPhoneNumber = genPhoneNumber()
  const attachments = [{ filename: 'some/path', width: 42, height: 42, voiceNote: false }]
  let channel, admins, subscribers, writeStub, readSock

  const createChannelWithMembers = async () => {
    channel = await app.db.channel.create(channelFactory({ socketId }))
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
    readSock = await app.socketPools[socketId].acquire()
    writeStub = sinon.stub(socket, 'write').returns(Promise.resolve())
  })
  afterEach(async () => {
    try {
      await destroyAllChannels(app.db)
      await app.socketPools[socketId].release(readSock)
      sinon.restore()
    } catch (ignored) {
      /**/
    }
  })
  after(async () => await app.stop())

  describe('dispatching a broadcast message', () => {
    beforeEach(async function() {
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
              body: '! foobar',
              expiresInSeconds: channel.messageExpiryTime,
              attachments,
            },
          },
        }),
      )
      // wait longer b/c we send broadcast messages in sequence
      this.timeout(12 * socketDelay)
      await wait(6 * socketDelay)
    })

    it('relays the message to all admins and subscribers', () => {
      expect(getSentMessages(writeStub)).to.have.deep.members([
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[0].memberPhoneNumber },
          messageBody: `[BROADCAST]\nfoobar`,
          attachments,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[1].memberPhoneNumber },
          messageBody: `[BROADCAST]\nfoobar`,
          attachments,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: subscribers[0].memberPhoneNumber },
          messageBody: `[${channel.name}]\nfoobar`,
          attachments,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: subscribers[1].memberPhoneNumber },
          messageBody: `[${channel.name}]\nfoobar`,
          attachments,
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
              attachments,
            },
          },
        }),
      )
      await wait(2 * socketDelay)
    })

    it('responds to the sender and relays the hotline message to all admins', () => {
      expect(getSentMessages(writeStub)).to.have.deep.members([
        {
          messageBody:
            'Your message was forwarded to the admins of [#red-alert].\n  \nSend HELP to list valid commands. Send HELLO to subscribe.',
          recipientAddress: {
            number: randoPhoneNumber,
          },
          type: 'send',
          username: channel.phoneNumber,
          attachments: [],
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[0].memberPhoneNumber },
          messageBody: `[HOTLINE FROM @1]\na screaming came across the sky`,
          attachments,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[1].memberPhoneNumber },
          messageBody: `[HOTLINE FROM @1]\na screaming came across the sky`,
          attachments,
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
              attachments,
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

    it('sends a welcome message to the sender and sets the expiration timer', () => {
      expect(getSentMessages(writeStub)).to.eql([
        {
          messageBody: messagesIn(languages.EN).commandResponses.join.success(channel),
          recipientAddress: { number: randoPhoneNumber },
          type: 'send',
          username: channel.phoneNumber,
          attachments: [],
        },
        {
          expiresInSeconds: channel.messageExpiryTime,
          recipientAddress: {
            number: randoPhoneNumber,
          },
          type: 'set_expiration',
          username: channel.phoneNumber,
        },
      ])
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
              body: 'REPLY @1 it has happened before but there is nothing to compare it to now',
              expiresInSeconds: channel.messageExpiryTime,
              attachments,
            },
          },
        }),
      )
      await wait(2 * socketDelay)
    })

    it('relays the hotline reply to hotline message sender and all admins', () => {
      expect(getSentMessages(writeStub)).to.have.deep.members([
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[0].memberPhoneNumber },
          messageBody: `[REPLY TO @1]\nit has happened before but there is nothing to compare it to now`,
          attachments,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[1].memberPhoneNumber },
          messageBody: `[REPLY TO @1]\nit has happened before but there is nothing to compare it to now`,
          attachments,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: randoPhoneNumber },
          messageBody: `[PRIVATE REPLY FROM ADMINS]\nit has happened before but there is nothing to compare it to now`,
          attachments,
        },
      ])
    })
  })

  describe('dispatching a PRIVATE message', () => {
    beforeEach(async () => {
      await createChannelWithMembers()
      readSock.emit(
        'data',
        JSON.stringify({
          type: 'message',
          data: {
            username: channel.phoneNumber,
            source: { number: admins[0].memberPhoneNumber },
            dataMessage: {
              timestamp: new Date().toISOString(),
              body: 'PRIVATE There was a wall. It did not look important.',
              expiresInSeconds: channel.messageExpiryTime,
              attachments,
            },
          },
        }),
      )
      await wait(2 * socketDelay)
    })

    it('relays the private message to all admins', () => {
      expect(getSentMessages(writeStub)).to.have.deep.members([
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[0].memberPhoneNumber },
          messageBody: `[PRIVATE]\nThere was a wall. It did not look important.`,
          attachments,
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientAddress: { number: admins[1].memberPhoneNumber },
          messageBody: `[PRIVATE]\nThere was a wall. It did not look important.`,
          attachments,
        },
      ])
    })
  })
})
