import { prettyPrint } from '../../util'

const util = require('../../util')
const { get } = require('lodash')
const { errors, statuses, errorStatus, extractStatus } = require('./common')
const phoneNumbers = require('../../../db/repositories/phoneNumber')
const {
  time: { verificationTimeout },
} = require('../../../config/index')

/**
 * type PhoneNumberStatus = {
 *   phoneNumber: string,
 *   status: 'PURCHASED' | 'REGISTERED' | 'VERIFIED' | 'ACTIVE'
 * }
 */

// PUBLIC FUNCTIONS

// ({Database, Emitter}) => Promise<Array<PhoneNumberStatus>>
const registerAll = async ({ db, emitter, filter }) =>
  db.phoneNumber
    .findAll({ where: filter })
    .then(phoneNumberStatuses =>
      Promise.all(
        phoneNumberStatuses.map(({ phoneNumber }) => register({ db, emitter, phoneNumber })),
      ),
    )

// ({Database, Emitter, string}) => Promise<PhoneNumberStatus>
const register = ({ db, emitter, phoneNumber }) =>
  util
    .exec(`signal-cli -u ${phoneNumber} register`)
    .then(() => recordStatusChange(db, phoneNumber, statuses.REGISTERED))
    .catch(err => errorStatus(errors.registrationFailed(err), phoneNumber))
    .then(maybeListenForVerification({ emitter, phoneNumber }))

// ({Database, Emitter, string, string}) => Promise<Boolean>
const verify = ({ db, emitter, phoneNumber, verificationMessage }) =>
  util
    .exec(`signal-cli -u ${phoneNumber} verify ${parseVerificationCode(verificationMessage)}`)
    .then(() => recordStatusChange(db, phoneNumber, statuses.VERIFIED))
    .then(phoneNumberStatus => Promise.resolve(emitter.emit('verified', phoneNumberStatus)))
    .catch(err =>
      Promise.reject(
        emitter.emit(
          'verificationFailed',
          errorStatus(errors.verificationFailed(err), phoneNumber),
        ),
      ),
    )

// HELPERS

const maybeListenForVerification = ({ emitter, phoneNumber }) => registrationStatus =>
  registrationStatus.status === statuses.ERROR
    ? Promise.resolve(registrationStatus)
    : listenForVerification({ emitter, phoneNumber })

const listenForVerification = ({ emitter, phoneNumber }) =>
  new Promise(resolve => {
    // resolve when a verification success/error event is fired, OR timeout interval elapses

    emitter.on('verified', function handle(phoneNumberStatus) {
      if (get(phoneNumberStatus, 'phoneNumber') === phoneNumber) {
        emitter.removeListener('verified', handle)
        resolve(phoneNumberStatus)
      }
    })

    emitter.on('verificationFailed', function handle(phoneNumberStatus) {
      if (get(phoneNumberStatus, 'phoneNumber') === phoneNumber) {
        emitter.removeListener('verificationFailed', handle)
        resolve(phoneNumberStatus)
      }
    })

    setTimeout(
      () => resolve({ status: statuses.ERROR, phoneNumber, error: errors.verificationTimeout }),
      verificationTimeout,
    )
  })

const recordStatusChange = (db, phoneNumber, status) =>
  phoneNumbers.update(db, phoneNumber, { status }).then(extractStatus)

const parseVerificationCode = verificationMessage =>
  verificationMessage.match(/Your Signal verification code: (\d\d\d-\d\d\d)/)[1]

// EXPORTS

module.exports = { registerAll, register, verify, parseVerificationCode }
