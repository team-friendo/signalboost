import { genPhoneNumber } from './phoneNumber'
import { random } from 'lodash'

export const smsSenderFactory = attrs => ({
  phoneNumber: genPhoneNumber(),
  messagesSent: random(0, 3),
  ...attrs,
})
