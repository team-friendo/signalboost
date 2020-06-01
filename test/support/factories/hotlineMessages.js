import { random } from 'lodash'
import { genPhoneNumber } from './phoneNumber'

export const hotlineMessageFactory = attrs => ({
  id: random(0, 1000000),
  channelPhoneNumber: genPhoneNumber(),
  memberPhoneNumber: genPhoneNumber(),
  ...attrs,
})
