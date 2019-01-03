const {
  twilio: { accountSid, authToken, smsUrl },
} = require('../../config')
const uuid = require('uuid/v4')
const { pick, isEmpty } = require('lodash')

// SINGLETONS

/**
 * NOTE(aguestuser|Wed 02 Jan 2019):
 * - the second singleton `availableTwilioNumbers` is included as a (somewhat awkward)
 *   testing seam due to the way that the twilio api client is structured
 *   (you can't just stub `#availablePhoneNumbers` for REASONS (grr...)
 * - instead, we we make a weird singleton so we can stub the entire singleton's call to `list`, which works
 * - if we ever want to paramaterize the country code, we could provide a lookup table of
 *   signgletons here, then and dispatch off of a country code argument passed to #search
 *   to use the correct singleton
 */

const twilioClient = require('twilio')(accountSid, authToken)
const availableTwilioNumbers = twilioClient.availablePhoneNumbers('US').local

// STRINGS

const statuses = {
  ERROR: 'ERROR',
  PURCHASED: 'PURCHASED',
  VERIFICATION_REQUESTED: 'VERIFICATION_REQUESTED',
  VERIFIED: 'VERIFIED',
}

const errors = {
  searchEmpty: 'ERROR: search terms not satisfied',
  dbWriteFailed: err => `ERROR: failed database write -- ${err}`,
}

// MAIN FUNCTION

const purchase = ({ db, areaCode }) =>
  search(areaCode)
    .then(create)
    .then(recordPurchase(db))
    .catch(reportError)

// HELPERS

const search = areaCode =>
  availableTwilioNumbers
    .list({ areaCode, smsEnabled: true })
    .then(numbers =>
      isEmpty(numbers) ? Promise.reject(errors.searchEmpty) : numbers[0].phoneNumber,
    )

const create = phoneNumber =>
  twilioClient.incomingPhoneNumbers
    .create({
      phoneNumber,
      smsMethod: 'POST',
      smsUrl,
      friendlyName: `signal-boost number ${uuid()}`,
    })
    .then(twilioPhoneNumber => twilioPhoneNumber.phoneNumber)

const recordPurchase = db => phoneNumber => {
  return db.phoneNumber
    .create({ phoneNumber, status: statuses.PURCHASED })
    .then(res => pick(res, ['phoneNumber', 'status']))
    .catch(err => reportError(errors.dbWriteFailed(err), phoneNumber))
}

const reportError = (error, phoneNumber) => ({
  status: statuses.ERROR,
  phoneNumber,
  error,
})

module.exports = { twilioClient, availableTwilioNumbers, statuses, errors, purchase }
