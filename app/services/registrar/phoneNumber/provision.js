const { partition } = require('lodash')
const purchase = require('./purchase')
const register = require('./register')
const { statuses } = require('../../../db/models/phoneNumber')
const {
  signal: { registrationBatchSize },
} = require('../../../config')

const errorMessages = {
  registrationBatchSizeExceeded: `A maximum of ${registrationBatchSize} phone numbers may be provisioned at a time`,
}

// ({ Database, Socket, string, number }) -> Array<PhoneNumberStatus>
const provisionN = async ({ areaCode, n }) => {
  if (n > registrationBatchSize) {
    return Promise.resolve({ status: 'ERROR', error: errorMessages.registrationBatchSizeExceeded })
  }
  const [errored, purchased] = partitionErrors(await purchase.purchaseN({ areaCode, n }))
  const [_errored, registered] = partitionErrors(
    await register.registerMany({ phoneNumbers: purchased.map(p => p.phoneNumber) }),
  )
  return [...errored, ..._errored, ...registered]
}

const partitionErrors = phoneNumberStatuses =>
  partition(phoneNumberStatuses, ({ status }) => status === statuses.ERROR)

module.exports = { errorMessages, provisionN }
