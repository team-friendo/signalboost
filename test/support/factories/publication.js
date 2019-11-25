import { genPhoneNumber } from './phoneNumber'

export const publicationFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  adminPhoneNumber: genPhoneNumber(),
  ...attrs,
})
