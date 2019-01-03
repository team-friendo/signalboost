import { genPhoneNumber } from "./phoneNumber"

export const subscriptionFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  humanPhoneNumber: genPhoneNumber(),
  ...attrs,
})
