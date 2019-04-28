import { publicationFactory } from './publication'
import { subscriptionFactory } from './subscription'
import { messageCountFactory } from "./messageCount"
import { welcomeFactory } from "./welcome"

const { times } = require('lodash')
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
    publications: times(2, () => publicationFactory({ channelPhoneNumber })),
    subscriptions: times(2, () => subscriptionFactory({ channelPhoneNumber })),
    messageCount: messageCountFactory({ channelPhoneNumber }),
    welcomes: times(2, () => welcomeFactory({ channelPhoneNumber })),
  }
}

export const deepChannelAttrs = [
  {
    name: 'foo',
    phoneNumber: '+11111111111',
    publications: [
      { channelPhoneNumber: '+11111111111', publisherPhoneNumber: '+12222222222' },
      { channelPhoneNumber: '+11111111111', publisherPhoneNumber: '+13333333333' },
    ],
    subscriptions: [
      { channelPhoneNumber: '+11111111111', subscriberPhoneNumber: '+14444444444' },
      { channelPhoneNumber: '+11111111111', subscriberPhoneNumber: '+15555555555' },
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
    publications: [
      { channelPhoneNumber: '+19999999999', publisherPhoneNumber: '+16666666666' },
    ],
    subscriptions: [{ channelPhoneNumber: '+19999999999', subscriberPhoneNumber: '+17777777777' }],
    messageCount: {
      broadcastIn: 100,
      broadcastOut: 100,
      commandIn: 20,
      commandOut: 20,
    },
    welcomes: [{ channelPhoneNumber: '+19999999999', welcomedPhoneNumber: '+16666666666' }],
  },
]
