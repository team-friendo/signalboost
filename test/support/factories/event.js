import { sample, random } from 'lodash'
import { eventTypes } from '../../../app/db/models/event'
import { sha256Hash } from '../../../app/util'

export const eventFactory = attrs => ({
  type: sample(eventTypes),
  phoneNumberHash: sha256Hash(random().toString()),
  metadata: { memberCount: null, messageCount: null },
  ...attrs,
})

module.exports = { eventFactory }
