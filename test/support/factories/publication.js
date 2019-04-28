import { genPhoneNumber } from './phoneNumber'

export const publicationFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  publisherPhoneNumber: genPhoneNumber(),
  ...attrs,
})
