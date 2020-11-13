import { genPhoneNumber } from './phoneNumber'
import { adminMembershipFactory } from './membership'
import { times } from 'lodash'

export const destructionRequestFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  createdAt: new Date(),
  lastNotifiedAt: new Date(),
  ...attrs,
})

export const deepDestructionRequestFactory = attrs => {
  const channelPhoneNumber = genPhoneNumber()
  return {
    channelPhoneNumber,
    createdAt: new Date(),
    lastNotifiedAt: new Date(),
    channel: {
      phoneNumber: channelPhoneNumber,
      memberships: times(2, () => adminMembershipFactory({ channelPhoneNumber })),
    },
    ...attrs,
  }
}
