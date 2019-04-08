import { random } from 'lodash'
import { genPhoneNumber } from './phoneNumber'

export const messageCountFactory = defaults => ({
  phoneNumber: genPhoneNumber(),
  broadcastIn: random(0, 100),
  broadcastOut: random(0, 10000),
  commandIn: random(0, 100),
  commandOut: random(0, 100),
  ...defaults,
})
