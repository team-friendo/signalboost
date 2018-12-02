import { phoneNumberFactory } from "./phoneNumber"

export const subscriptionFactory = attrs => ({
  channelPhoneNumber: phoneNumberFactory(),
  humanPhoneNumber: phoneNumberFactory(),
  ...attrs,
})