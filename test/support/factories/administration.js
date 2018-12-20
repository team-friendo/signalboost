import { phoneNumberFactory } from './phoneNumber'

export const administrationFactory = attrs => ({
  channelPhoneNumber: phoneNumberFactory(),
  humanPhoneNumber: phoneNumberFactory(),
  ...attrs,
})
