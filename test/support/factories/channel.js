import { adminMembershipFactory, subscriberMembershipFactory } from './membership'

const { times } = require('lodash')
import { messageCountFactory } from './messageCount'
import { welcomeFactory } from './welcome'
import { memberTypes } from '../../../app/db/repositories/membership'
import { inviteFactory } from "./invite"
const { genPhoneNumber } = require('./phoneNumber')

export const channelFactory = attrs => ({
  phoneNumber: genPhoneNumber(),
  name: '#red-alert',
  ...attrs,
})

export const deepChannelFactory = pNum => {
  const channelPhoneNumber = pNum || genPhoneNumber()
  return {
    ...channelFactory({ phoneNumber: channelPhoneNumber }),
    memberships: [
      ...times(2, () => adminMembershipFactory({ channelPhoneNumber })),
      ...times(2, () => subscriberMembershipFactory({ channelPhoneNumber })),
    ],
    messageCount: messageCountFactory({ channelPhoneNumber }),
    invites: times(2, () => inviteFactory({ channelPhoneNumber })),
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
    messageCount: {
      broadcastIn: 2,
      broadcastOut: 4,
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
    messageCount: {
      broadcastIn: 100,
      broadcastOut: 100,
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
