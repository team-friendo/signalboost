const uuid = require('uuid/v4')
const { isEmpty, times, identity } = require('lodash')
const { errors, statuses, smsUrl, extractStatus, errorStatus } = require('./common')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const {
  twilio: { accountSid, authToken },
} = require('../../config')

/**
 * NOTE(aguestuser|Wed 02 Jan 2019):
 * - the second singleton `availableTwilioNumbers` is included as a (somewhat awkward)
 *   testing seam due to the way that the twilio registrar client is structured
 *   (you can't just stub `#availablePhoneNumbers` for REASONS (grr...)
 * - instead, we we make a weird singleton so we can stub the entire singleton's call to `list`, which works
 * - if we ever want to paramaterize the country code, we could provide a lookup table of
 *   signgletons here, then and dispatch off of a country code argument passed to #search
 *   to use the correct singleton
 */

// SINGLETONS

const twilioClient = require('twilio')(accountSid, authToken)
const availableTwilioNumbers = twilioClient.availablePhoneNumbers('US').local

// MAIN FUNCTION

const purchaseN = ({ areaCode, n }) => Promise.all(times(n, () => purchase({ areaCode })))

const purchase = ({ areaCode }) =>
  search(areaCode)
    .then(create)
    .then(recordPurchase())
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
      // Including the current environment in the registered number's friendlyName makes it simpler to clean up unused numbers originally intended for development.
      friendlyName: `${process.env.NODE_ENV} signal-boost number ${uuid()}`,
    })
    .catch(err => {
      // TODO(@zig): add prometheus error count here (counter: twilio_purchase_error)
      return Promise.reject(errorStatus(errors.purchaseFailed(err), phoneNumber))
    })

const recordPurchase = () => ({ phoneNumber, sid }) =>
  phoneNumberRepository
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
