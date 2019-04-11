const fs = require('fs-extra')
const { get, without } = require('lodash')
const { errors, statuses, errorStatus, extractStatus } = require('./common')
const util = require('../../util')
const phoneNumbers = require('../../../db/repositories/phoneNumber')
const {
  signal: { verificationTimeout, keystorePath },
} = require('../../../config/index')

/**
 * type PhoneNumberStatus = {
 *   phoneNumber: string,
 *   status: 'PURCHASED' | 'REGISTERED' | 'VERIFIED' | 'ACTIVE'
 * }
 */

// PUBLIC FUNCTIONS

// ({Database, Emitter, object}) => Promise<Array<PhoneNumberStatus>>
const registerAll = async ({ db, emitter, filter }) => {
  const phoneNumberStatuses = await db.phoneNumber.findAll({ where: filter })
  return Promise.all(
    phoneNumberStatuses.map(({ phoneNumber }) => register({ db, emitter, phoneNumber })),
  )
}

// ({Database, Emitter, object }) => Promise<Array<PhoneNumberStatus>>
const registerAllUnregistered = async ({ db, emitter }) => {
  const phoneNumberStatuses = await db.phoneNumber.findAll()
  const results = await Promise.all(
    phoneNumberStatuses.map(async ({ phoneNumber }) =>
      (await isRegistered(phoneNumber)) ? null : register({ db, emitter, phoneNumber }),
    ),
  )
  return without(results, null)
}

// ({Database, Emitter, string}) => Promise<PhoneNumberStatus>
const register = ({ db, emitter, phoneNumber }) =>
  util
    .exec(`signal-cli -u ${phoneNumber} register`)
    .then(() => recordStatusChange(db, phoneNumber, statuses.REGISTERED))
    .catch(err => {
      // TODO(@zig): add prometheus error count here (counter: signal_register_error)
      return errorStatus(errors.registrationFailed(err), phoneNumber)
    })
    .then(maybeListenForVerification({ emitter, phoneNumber }))

// ({Database, Emitter, string, string}) => Promise<Boolean>
const verify = ({ db, emitter, phoneNumber, verificationMessage }) =>
  util
    .exec(`signal-cli -u ${phoneNumber} verify ${parseVerificationCode(verificationMessage)}`)
    .then(() => recordStatusChange(db, phoneNumber, statuses.VERIFIED))
    .then(phoneNumberStatus => Promise.resolve(emitter.emit('verified', phoneNumberStatus)))
    .catch(err => {
      // TODO(@zig): add promethues error count here (counter: signal_verify_error)
      return Promise.reject(
        emitter.emit(
          'verificationFailed',
          errorStatus(errors.verificationFailed(err), phoneNumber),
        ),
      )
    })

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

const isRegistered = phoneNumber => fs.pathExists(`${keystorePath}/${phoneNumber}`)

// EXPORTS

module.exports = { registerAllUnregistered, registerAll, register, verify, parseVerificationCode }
