import { genPhoneNumber } from './phoneNumber'

export const welcomeFactory = defaults => ({
  channelPhoneNumber: genPhoneNumber(),
  welcomedPhoneNumber: genPhoneNumber(),
  ...defaults,
})
