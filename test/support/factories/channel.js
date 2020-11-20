import { adminMembershipFactory, subscriberMembershipFactory } from './membership'
import { get, times, random } from 'lodash'
import { messageCountFactory } from './messageCount'
import { memberTypes } from '../../../app/db/repositories/membership'
import { inviteFactory } from './invite'
import { genPhoneNumber } from './phoneNumber'
import { deauthorizationFactory } from './deauthorization'
const {
  signal: { defaultMessageExpiryTime },
} = require('../../../app/config')

export const channelFactory = attrs => ({
  phoneNumber: genPhoneNumber(),
  name: '#red-alert',
  messageExpiryTime: defaultMessageExpiryTime,
  socketId: random(0, 9),
  ...attrs,
})

export const deepChannelFactory = attrs => {
  const channelPhoneNumber = get(attrs, 'phoneNumber') || genPhoneNumber()
  return {
    ...channelFactory({ phoneNumber: channelPhoneNumber }),
    memberships: [
      ...times(2, () => adminMembershipFactory({ channelPhoneNumber })),
      ...times(2, () => subscriberMembershipFactory({ channelPhoneNumber })),
    ],
    messageCount: messageCountFactory({ channelPhoneNumber }),
    invites: times(2, () => inviteFactory({ channelPhoneNumber })),
    deauthorizations: [deauthorizationFactory({ channelPhoneNumber })],
    destructionRequest: { channelPhoneNumber },
    ...attrs,
  }
}

export const deepChannelAttrs = [
  {
    name: 'foo',
    phoneNumber: '+11111111111',
    memberships: [
      {
        type: memberTypes.ADMIN,
        channelPhoneNumber: '+11111111111',
        memberPhoneNumber: '+12222222222',
      },
      {
        type: memberTypes.ADMIN,
        channelPhoneNumber: '+11111111111',
        memberPhoneNumber: '+13333333333',
      },
      {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber: '+11111111111',
        memberPhoneNumber: '+14444444444',
      },
      {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber: '+11111111111',
        memberPhoneNumber: '+15555555555',
      },
    ],
    socketId: 0,
    messageCount: {
      broadcastIn: 2,
      broadcastOut: 4,
      hotlineIn: 4,
      hotlineOut: 2,
      commandIn: 5,
      commandOut: 6,
    },
    invites: [
      {
        channelPhoneNumber: '+11111111111',
        inviterPhoneNumber: '+12222222222',
        inviteePhoneNumber: '+12222222223',
      },
      {
        channelPhoneNumber: '+11111111111',
        inviterPhoneNumber: '+12222222222',
        inviteePhoneNumber: '+12222222224',
      },
    ],
    deauthorizations: [
      {
        channelPhoneNumber: '+11111111111',
        memberPhoneNumber: '+10000000000',
        fingerprint:
          '05 6b c5 19 fc aa 44 57 3f 2d 2e 39 c7 73 a4 13 6a 51 3d 95 33 08 9b d3 32 84 01 99 4d ae 63 8c 6f',
      },
    ],
  },
  {
    name: 'bar',
    phoneNumber: '+19999999999',
    memberships: [
      {
        type: memberTypes.ADMIN,
        channelPhoneNumber: '+19999999999',
        memberPhoneNumber: '+16666666666',
      },
      {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber: '+19999999999',
        memberPhoneNumber: '+17777777777',
      },
    ],
    socketId: 1,
    messageCount: {
      broadcastIn: 100,
      broadcastOut: 100,
      hotlineIn: 2,
      hotlineOut: 4,
      commandIn: 20,
      commandOut: 20,
    },
    invites: [
      {
        channelPhoneNumber: '+19999999999',
        inviterPhoneNumber: '+16666666666',
        inviteePhoneNumber: '+16666666667',
      },
      {
        channelPhoneNumber: '+19999999999',
        inviterPhoneNumber: '+16666666666',
        inviteePhoneNumber: '+16666666668',
      },
    ],
  },
]
