const { pick } = require('lodash')
const { statuses } = require('../../db/models/phoneNumber')

// STRINGS

const errors = {
  searchEmpty: 'twilio number search terms not satisfied',
  dbWriteFailed: err => `database write failed: ${err}`,
  registrationFailed: err => `signal registration failed: ${err}`,
  verificationFailed: err => `signal verification failed: ${err}`,
  verificationTimeout: 'signal verification timed out',
}

const errorStatus = (error, phoneNumber) => ({
  status: statuses.ERROR,
  phoneNumber,
  error,
})

const extractStatus = phoneNumberInstance => pick(phoneNumberInstance, ['status', 'phoneNumber'])

module.exports = {
  errors,
  statuses,
  errorStatus,
  extractStatus,
}
