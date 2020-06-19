const { pick } = require('lodash')
const phoneNumberRepository = require('../../../db/repositories/phoneNumber')

const list = filter =>
  phoneNumberRepository
    .list(filter)
    .then(phoneNumbers => ({
      status: 'SUCCESS',
      data: {
        count: phoneNumbers.length,
        phoneNumbers: phoneNumbers.map(formatForList),
      },
    }))
    .catch(error => ({
      status: 'ERROR',
      data: { error },
    }))

const formatForList = phoneNumber => pick(phoneNumber, ['phoneNumber', 'status', 'twilioSid'])

module.exports = { list }
