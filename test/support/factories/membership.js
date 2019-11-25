import { genPhoneNumber } from './phoneNumber'
import { sample } from 'lodash'
import { defaultLanguage } from '../../../app/config'

export const membershipFactory = attrs => ({
  type: sample(['ADMIN', 'SUBSCRIBER']),
  channelPhoneNumber: genPhoneNumber(),
  memberPhoneNumber: genPhoneNumber(),
  language: defaultLanguage,
  ...attrs,
})

export const adminMembershipFactory = attrs => membershipFactory({ ...attrs, type: 'ADMIN' })
export const subscriberMembershipFactory = attrs =>
  membershipFactory({ ...attrs, type: 'SUBSCRIBER' })
