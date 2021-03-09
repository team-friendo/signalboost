import { genPhoneNumber } from './phoneNumber'

export const channelRequestFactory = attrs => ({
  adminPhoneNumbers: JSON.stringify([genPhoneNumber(), genPhoneNumber()]),
  ...attrs,
})

module.exports = { channelRequestFactory }
