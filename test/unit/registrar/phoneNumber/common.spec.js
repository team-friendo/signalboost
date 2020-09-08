import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../../../app/db/repositories/channel'
import signal from '../../../../app/signal'
import { deepChannelFactory } from '../../../support/factories/channel'
import { times } from 'lodash'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../../../support/factories/membership'
import common, { notificationKeys } from '../../../../app/registrar/phoneNumber/common'
import { sdMessageOf } from '../../../../app/signal/constants'
import { messagesIn } from '../../../../app/dispatcher/strings/messages'
import { defaultLanguage } from '../../../../app/config'

describe('phone number registrar -- common module', () => {
  const channel = deepChannelFactory({
    memberships: [
      adminMembershipFactory({ language: 'DE' }),
      adminMembershipFactory({ language: 'FR' }),
      subscriberMembershipFactory({ language: 'ES' }),
      subscriberMembershipFactory({ language: 'DE' }),
    ],
  })
  let findChannelStub, broadcastMessageStub, sendMessageStub

  beforeEach(() => {
    findChannelStub = sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(channel))
    broadcastMessageStub = sinon
      .stub(signal, 'broadcastMessage')
      .callsFake(numbers => numbers.map(() => '42'))
    sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve('42'))
  })
  afterEach(() => sinon.restore())

  describe('#notifyAdmins', () => {
    it('sends a notification to each admin in their language', async () => {
      await common.notifyAdmins(channel, notificationKeys.CHANNEL_RECYCLED)
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
      await common.notifyMembers(channel, notificationKeys.CHANNEL_DESTROYED)
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
      await common.notifyMaintainers('foo')
      expect(broadcastMessageStub.callCount).to.eql(1)
      expect(broadcastMessageStub.getCall(0).args).to.eql([
        [channel.memberships[0].memberPhoneNumber, channel.memberships[1].memberPhoneNumber],
        sdMessageOf(channel, 'foo'),
      ])
    })
  })
})
