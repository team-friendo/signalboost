const fs = require('fs-extra')
const { without } = require('lodash')
const { errors, statuses, errorStatus, extractStatus } = require('./common')
const phoneNumbers = require('../../db/repositories/phoneNumber')
const signal = require('../signal')
const { loggerOf } = require('../util')
const logger = loggerOf('FIXME')
const {
  signal: { keystorePath },
} = require('../../config/index')

/**
 * type PhoneNumberStatus = {
 *   phoneNumber: string,
 *   status: 'PURCHASED' | 'REGISTERED' | 'VERIFIED' | 'ACTIVE'
 * }
 */

// PUBLIC FUNCTIONS

// ({Database, Socket, object}) => Promise<Array<PhoneNumberStatus>>
const registerAll = async ({ db, sock, filter }) => {
  const phoneNumberStatuses = await db.phoneNumber.findAll({ where: filter })
  return Promise.all(
    phoneNumberStatuses.map(({ phoneNumber }) => register({ db, sock, phoneNumber })),
  )
}

// ({Database, Emitter, object }) => Promise<Array<PhoneNumberStatus>>
const registerAllUnregistered = async ({ db, sock }) => {
  const phoneNumberStatuses = await db.phoneNumber.findAll()
  // TODO: space registrations by 1 second to avoid rate limiting
  const results = await Promise.all(
    phoneNumberStatuses.map(async phoneNumberStatus =>
      (await isRegistered(phoneNumberStatus))
        ? null
        : register({ db, sock, phoneNumber: phoneNumberStatus.phoneNumber }),
    ),
  )
  return without(results, null)
}

// ({Database, Socket, string}) => Promise<PhoneNumberStatus>
const register = ({ db, sock, phoneNumber }) =>
  signal
    .register(sock, phoneNumber)
    .then(() => signal.awaitVerificationResult(sock, phoneNumber))
    .then(() => recordStatusChange(db, phoneNumber, statuses.VERIFIED))
    .catch(err => {
      // TODO(@zig): add prometheus error count here (counter: signal_register_error)
      // we record (partial) registration *after* verification failure
      // to avoid missing verification success sock msg while performing db write
      logger.error(err)
      recordStatusChange(db, phoneNumber, statuses.REGISTERED).then(() =>
        errorStatus(errors.registrationFailed(err), phoneNumber),
      )
    })

// ({Database, Emitter, string, string}) => Promise<Boolean>
const verify = ({ sock, phoneNumber, verificationMessage }) =>
  signal
    .verify(sock, phoneNumber, signal.parseVerificationCode(verificationMessage))
    .then(() => signal.awaitVerificationResult(phoneNumber))

// HELPERS

const recordStatusChange = (db, phoneNumber, status) =>
  phoneNumbers.update(db, phoneNumber, { status }).then(extractStatus)

const isRegistered = async phoneNumberStatus =>
  phoneNumberStatus.status === statuses.VERIFIED &&
  (await fs.pathExists(`${keystorePath}/${phoneNumberStatus.phoneNumber}`))

// EXPORTS

module.exports = { registerAllUnregistered, registerAll, register, verify }
