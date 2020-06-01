import { genPhoneNumber } from './phoneNumber'

export const hotlineMessageFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  memberPhoneNumber: genPhoneNumber(),
  ...attrs,
})
