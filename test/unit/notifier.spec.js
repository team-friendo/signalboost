import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../app/db/repositories/channel'
import signal from '../../app/signal'
import { map } from 'lodash'
import { deepChannelFactory } from '../support/factories/channel'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../support/factories/membership'
import notifier, { notificationKeys } from '../../app/notifier'
import { sdMessageOf } from '../../app/signal/constants'
import { messagesIn } from '../../app/dispatcher/strings/messages'

describe('notifier module', () => {
  const channel = deepChannelFactory({
    memberships: [
      adminMembershipFactory({ language: 'DE' }),
      adminMembershipFactory({ language: 'FR' }),
      subscriberMembershipFactory({ language: 'ES' }),
      subscriberMembershipFactory({ language: 'DE' }),
    ],
  })
  let sendMessageStub

  beforeEach(() => {
    sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channel))
    sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve('42'))
  })
  afterEach(() => sinon.restore())

  describe('#notifyAdmins', () => {
    describe('when given a notification that takes no arguments', () => {
      it('sends a notification to each admin in their language', async () => {
        await notifier.notifyAdmins(channel, notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM)
        expect(sendMessageStub.callCount).to.eql(2)
        expect(map(sendMessageStub.getCalls(), 'args')).to.have.deep.members([
          [
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: channel.memberships[0].memberPhoneNumber,
              message: messagesIn('DE').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
            }),
            channel.socketId,
          ],
          [
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: channel.memberships[1].memberPhoneNumber,
              message: messagesIn('FR').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
            }),
            channel.socketId,
          ],
        ])
      })
    })
    describe('when given a notification key that takes arguments', () => {
      it('constructs notification to each admin in their language and sends it', async () => {
        const channelTtl = 24
        await notifier.notifyAdmins(channel, notificationKeys.CHANNEL_DESTRUCTION_SCHEDULED, [
          channelTtl,
        ])
        expect(map(sendMessageStub.getCalls(), 'args')).to.have.deep.members([
          [
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: channel.memberships[0].memberPhoneNumber,
              message: messagesIn('DE').notifications[
                notificationKeys.CHANNEL_DESTRUCTION_SCHEDULED
              ](channelTtl),
            }),
            channel.socketId,
          ],
          [
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: channel.memberships[1].memberPhoneNumber,
              message: messagesIn('FR').notifications[
                notificationKeys.CHANNEL_DESTRUCTION_SCHEDULED
              ](channelTtl),
            }),
            channel.socketId,
          ],
        ])
      })
    })
  })

  describe('#notifyMembers', () => {
    it('sends a notification to each member in their language', async () => {
      await notifier.notifyMembers(channel, notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM)
      expect(sendMessageStub.callCount).to.eql(4)
      expect(map(sendMessageStub.getCalls(), 'args')).to.have.deep.members([
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[0].memberPhoneNumber,
            message: messagesIn('DE').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
          }),
          channel.socketId,
        ],
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[1].memberPhoneNumber,
            message: messagesIn('FR').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
          }),
          channel.socketId,
        ],
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[2].memberPhoneNumber,
            message: messagesIn('ES').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
          }),
          channel.socketId,
        ],
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[3].memberPhoneNumber,
            message: messagesIn('DE').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
          }),
          channel.socketId,
        ],
      ])
    })
  })

  describe('#notifyMembersExcept', () => {
    it('sends a language-appropriate notification to all members except the sender', async () => {
      await notifier.notifyMembersExcept(
        channel,
        channel.memberships[0],
        notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM,
      )
      expect(map(sendMessageStub.getCalls(), 'args')).to.have.deep.members([
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[1].memberPhoneNumber,
            message: messagesIn('FR').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
          }),
          channel.socketId,
        ],
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[2].memberPhoneNumber,
            message: messagesIn('ES').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
          }),
          channel.socketId,
        ],
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[3].memberPhoneNumber,
            message: messagesIn('DE').notifications[notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM],
          }),
          channel.socketId,
        ],
      ])
    })
  })

  describe('#notifyMaintainers', () => {
    it('sends an untranslated notification to sysadmins of the instance', async () => {
      await notifier.notifyMaintainers('foo')
      expect(map(sendMessageStub.getCalls(), 'args')).to.have.deep.members([
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[0].memberPhoneNumber,
            message: 'foo',
          }),
          channel.socketId,
        ],
        [
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: channel.memberships[1].memberPhoneNumber,
            message: 'foo',
          }),
          channel.socketId,
        ],
      ])
    })
  })

  describe('#notifyMany', () => {
    it('constructs a message from a string')
    it('constructs a message from a notification key whose value is a function')
    it('constructs a message from a notification whose value is a string')
  })
})
