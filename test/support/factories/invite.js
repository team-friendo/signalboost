import { genPhoneNumber } from './phoneNumber'

export const inviteFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  inviterPhoneNumber: genPhoneNumber(),
  inviteePhoneNumber: genPhoneNumber(),
  ...attrs,
})
