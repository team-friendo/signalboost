import { genPhoneNumber } from './phoneNumber'

export const administrationFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  humanPhoneNumber: genPhoneNumber(),
  ...attrs,
})
