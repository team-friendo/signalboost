import { genPhoneNumber } from './phoneNumber'

export const banFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  memberPhoneNumber: genPhoneNumber(),
  ...attrs,
})
