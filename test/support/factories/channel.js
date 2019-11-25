import { adminMembershipFactory, subscriberMembershipFactory } from './membership'

const { times } = require('lodash')
import { messageCountFactory } from './messageCount'
import { welcomeFactory } from './welcome'
import { memberTypes } from '../../../app/db/repositories/membership'
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
    welcomes: times(2, () => welcomeFactory({ channelPhoneNumber })),
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
    welcomes: [{ channelPhoneNumber: '+11111111111', welcomedPhoneNumber: '+12222222222' }],
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
    welcomes: [{ channelPhoneNumber: '+19999999999', welcomedPhoneNumber: '+16666666666' }],
  },
]
