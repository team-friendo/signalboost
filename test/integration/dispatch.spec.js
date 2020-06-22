import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import app from '../../app'
import testApp from '../support/testApp'
import db from '../../app/db'
import socket from '../../app/socket'
import dispatcher from '../../app/dispatcher'
import { channelFactory } from '../support/factories/channel'
import { times } from 'lodash'
import { wait } from '../../app/util'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../support/factories/membership'

describe('dispatch', () => {
  const socketDelay = 5
  let channel, admins, subscribers, writeWithPoolStub

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

  before(async () => await app.run({ ...testApp, db, dispatcher }))
  beforeEach(() => {
    sinon.stub(app.sock, 'write').returns(Promise.resolve())
    // TODO(aguestuser|2020-06-22):
    //  move this stub to the actual socket after we've added a socket pool to `app` module
    writeWithPoolStub = sinon.stub(socket, 'writeWithPool').returns(Promise.resolve())
  })
  afterEach(async () => {
    await app.db.membership.destroy({ where: {}, force: true })
    await app.db.channel.destroy({ where: {}, force: true })
    sinon.restore()
  })
  after(async () => await app.stop())

  describe('dispatching a broadcast message', () => {
    beforeEach(async () => {
      await createChannelWithMembers()
      app.sock.emit(
        'data',
        JSON.stringify({
          type: 'message',
          data: {
            username: channel.phoneNumber,
            source: admins[0].memberPhoneNumber,
            dataMessage: {
              timestamp: new Date().toISOString(),
              message: 'foobar',
              expiresInSeconds: channel.messageExpiryTime,
              attachments: [],
            },
          },
        }),
      )
      await wait(socketDelay)
    })

    it('relays the message to all admins and subscribers', () => {
      const messages = times(4, n => writeWithPoolStub.getCall(n))
      expect(messages.map(m => m.args[0])).to.have.deep.members([
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientNumber: admins[0].memberPhoneNumber,
          messageBody: `[BROADCAST]\nfoobar`,
          attachments: [],
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientNumber: admins[1].memberPhoneNumber,
          messageBody: `[BROADCAST]\nfoobar`,
          attachments: [],
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientNumber: subscribers[0].memberPhoneNumber,
          messageBody: `[${channel.name}]\nfoobar`,
          attachments: [],
        },
        {
          type: 'send',
          username: channel.phoneNumber,
          recipientNumber: subscribers[1].memberPhoneNumber,
          messageBody: `[${channel.name}]\nfoobar`,
          attachments: [],
        },
      ])
    })
  })
})
