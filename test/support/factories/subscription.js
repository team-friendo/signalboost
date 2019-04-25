import { genPhoneNumber } from './phoneNumber'

export const subscriptionFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  subscriberPhoneNumber: genPhoneNumber(),
  ...attrs,
})
