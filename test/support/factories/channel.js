import { phoneNumberFactory } from './phoneNumber'

export const channelFactory = attrs => ({
  phoneNumber: phoneNumberFactory(),
  name: '#red-alert',
  ...attrs,
})
