import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../app/db/repositories/channel'
import signal from '../../app/signal'
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
  let broadcastMessageStub, sendMessageStub

  beforeEach(() => {
    sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channel))
    broadcastMessageStub = sinon
      .stub(signal, 'broadcastMessage')
      .callsFake(numbers => numbers.map(() => '42'))
    sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve('42'))
  })
  afterEach(() => sinon.restore())

  describe('#notifyAdmins', () => {
    it('sends a notification to each admin in their language', async () => {
      await notifier.notifyAdmins(channel, notificationKeys.CHANNEL_RECYCLED)
      expect(sendMessageStub.callCount).to.eql(2)
      expect(sendMessageStub.getCalls().map(x => x.args)).to.have.deep.members([
        [
          channel.memberships[0].memberPhoneNumber,
          sdMessageOf(channel, messagesIn('DE').notifications[notificationKeys.CHANNEL_RECYCLED]),
        ],
        [
          channel.memberships[1].memberPhoneNumber,
          sdMessageOf(channel, messagesIn('FR').notifications[notificationKeys.CHANNEL_RECYCLED]),
        ],
      ])
    })
  })

  describe('#notifyMembers', () => {
    it('sends a notification to each member in their language', async () => {
      await notifier.notifyMembers(channel, notificationKeys.CHANNEL_DESTROYED)
      expect(sendMessageStub.callCount).to.eql(4)
      expect(sendMessageStub.getCalls().map(x => x.args)).to.have.deep.members([
        [
          channel.memberships[0].memberPhoneNumber,
          sdMessageOf(channel, messagesIn('DE').notifications[notificationKeys.CHANNEL_DESTROYED]),
        ],
        [
          channel.memberships[1].memberPhoneNumber,
          sdMessageOf(channel, messagesIn('FR').notifications[notificationKeys.CHANNEL_DESTROYED]),
        ],
        [
          channel.memberships[2].memberPhoneNumber,
          sdMessageOf(channel, messagesIn('ES').notifications[notificationKeys.CHANNEL_DESTROYED]),
        ],
        [
          channel.memberships[3].memberPhoneNumber,
          sdMessageOf(channel, messagesIn('DE').notifications[notificationKeys.CHANNEL_DESTROYED]),
        ],
      ])
    })
  })

  describe('#notifyMaintainers', () => {
    it('sends an untranslated notification to sysadmins of the instance', async () => {
      await notifier.notifyMaintainers('foo')
      expect(broadcastMessageStub.callCount).to.eql(1)
      expect(broadcastMessageStub.getCall(0).args).to.eql([
        [channel.memberships[0].memberPhoneNumber, channel.memberships[1].memberPhoneNumber],
        sdMessageOf(channel, 'foo'),
      ])
    })
  })
})
