import { genPhoneNumber } from './phoneNumber'
import util from '../../../app/util'

export const banFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  memberPhoneNumber: util.sha256Hash(genPhoneNumber()),
  ...attrs,
})
