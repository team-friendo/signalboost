import { random } from 'lodash'
import { genPhoneNumber } from './phoneNumber'

export const messageCountFactory = defaults => ({
  channelPhoneNumber: genPhoneNumber(),
  broadcastIn: random(0, 100),
  broadcastOut: random(0, 10000),
  hotlineIn: random(0, 100),
  hotlineOut: random(0, 10000),
  commandIn: random(0, 100),
  commandOut: random(0, 100),
  ...defaults,
})
