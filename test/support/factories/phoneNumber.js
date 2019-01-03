import { times, random, sample } from 'lodash'
import { statuses } from '../../../app/db/models/phoneNumber'

export const genPhoneNumber = () => '+1' + times(10, () => random(0, 9).toString()).join('')

export const phoneNumberFactory = attrs => ({
  phoneNumber: genPhoneNumber(),
  status: sample(statuses),
  ...attrs,
})
