const uuid = require('uuid/v4')
const { isEmpty, times, identity } = require('lodash')
const { errors, statuses, extractStatus, errorStatus } = require('./common')
const {
  twilio: { accountSid, authToken, smsEndpoint },
  orchestrator: { host },
} = require('../../../config/index')

/**
 * NOTE(aguestuser|Wed 02 Jan 2019):
 * - the second singleton `availableTwilioNumbers` is included as a (somewhat awkward)
 *   testing seam due to the way that the twilio orchestrator client is structured
 *   (you can't just stub `#availablePhoneNumbers` for REASONS (grr...)
 * - instead, we we make a weird singleton so we can stub the entire singleton's call to `list`, which works
 * - if we ever want to paramaterize the country code, we could provide a lookup table of
 *   signgletons here, then and dispatch off of a country code argument passed to #search
 *   to use the correct singleton
 */

// SINGLETONS

const twilioClient = require('twilio')(accountSid, authToken)
const availableTwilioNumbers = twilioClient.availablePhoneNumbers('US').local

// CONSTANTS

const smsUrl = `https://${host}/${smsEndpoint}`

// MAIN FUNCTION

const purchaseN = ({ db, areaCode, n }) => Promise.all(times(n, () => purchase({ db, areaCode })))

const purchase = ({ db, areaCode }) =>
  search(areaCode)
    .then(create)
    .then(recordPurchase(db))
    .catch(identity)

// HELPERS

const search = areaCode =>
  availableTwilioNumbers
    .list({ areaCode, smsEnabled: true })
    .then(numbers =>
      isEmpty(numbers) ? Promise.reject(errors.searchEmpty) : numbers[0].phoneNumber,
    )
    .catch(err => Promise.reject(errorStatus(errors.searchFailed(err))))

const create = phoneNumber =>
  twilioClient.incomingPhoneNumbers
    .create({
      phoneNumber,
      smsMethod: 'POST',
      smsUrl,
      friendlyName: `signal-boost number ${uuid()}`,
    })
    .catch(err => Promise.reject(errorStatus(errors.purchaseFailed(err), phoneNumber)))

const recordPurchase = db => ({ phoneNumber, sid }) =>
  db.phoneNumber
    .create({ phoneNumber, twilioSid: sid, status: statuses.PURCHASED })
    .then(extractStatus)
    .catch(err => Promise.reject(errorStatus(errors.dbWriteFailed(err), phoneNumber)))

// EXPORTS

module.exports = {
  twilioClient,
  availableTwilioNumbers,
  purchase,
  purchaseN,
}
