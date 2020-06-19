const fs = require('fs-extra')
const { errors, statuses: pnStatuses, errorStatus, extractStatus } = require('./common')
const { statuses } = require('../../../services/util')
const { flatten, without } = require('lodash')
const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const signal = require('../../signal')
const { sequence, batchesOfN } = require('../../util')
const logger = require('../logger')
const {
  signal: {
    keystorePath,
    registrationBatchSize,
    intervalBetweenRegistrationBatches,
    intervalBetweenRegistrations,
  },
} = require('../../../config')

/**
 * type PhoneNumberStatus = {
 *   phoneNumber: string,
 *   status: 'PURCHASED' | 'REGISTERED' | 'VERIFIED' | 'ACTIVE'
 * }
 *
 * SOME TRICKY BITS:
 *
 * to observe rate limiting, we:
 * - separate phone numbers into batches of 5
 * - wait 2 seconds between registering each phone number in a batch
 * - wait 2 minutes between batches
 *
 * to avoid unnecessary key rollovers, we:
 * - don't attempt to register phone numbers that already have key material
 */

/********************
 * PUBLIC FUNCTIONS
 ********************/

// ({Database, Socket, Array<string>}) => Promise<Array<PhoneNumberStatus>>
const registerMany = async ({ sock, phoneNumbers }) => {
  const phoneNumberBatches = batchesOfN(phoneNumbers, registrationBatchSize)
  return flatten(
    await sequence(
      phoneNumberBatches.map(phoneNumberBatch => () => registerBatch({ sock, phoneNumberBatch })),
      intervalBetweenRegistrationBatches,
    ),
  )
}

// ({Database, Socket }) => Promise<Array<PhoneNumberStatus>>
const registerAllUnregistered = async ({ sock }) => {
  const allStatuses = await phoneNumberRepository.findAll()
  // this is a bit awkward but necessary b/c we can't just map/filter w/ Promises
  const unregisteredPhoneNumbers = without(
    await Promise.all(allStatuses.map(async s => ((await isRegistered(s)) ? null : s.phoneNumber))),
    null,
  )
  return registerMany({ sock, phoneNumbers: unregisteredPhoneNumbers })
}

// ({Database, Socket, string}) => Promise<PhoneNumberStatus>
const register = ({ sock, phoneNumber }) =>
  signal
    .register(sock, phoneNumber)
    .then(() => recordStatusChange(phoneNumber, pnStatuses.REGISTERED))
    .then(() => signal.awaitVerificationResult(sock, phoneNumber))
    .then(() => recordStatusChange(phoneNumber, pnStatuses.VERIFIED))
    .catch(err => {
      // TODO(@zig): add prometheus error count here (counter: signal_register_error)
      logger.error(err)
      return errorStatus(errors.registrationFailed(err), phoneNumber)
    })

// ({Emitter, string, string}) => Promise<SignalboostStatus>
const verify = ({ sock, phoneNumber, verificationCode }) =>
  signal
    .verify(sock, phoneNumber, verificationCode)
    .then(() => signal.awaitVerificationResult(sock, phoneNumber))
    .then(() => ({ status: statuses.SUCCESS, message: 'OK' }))
    .catch(e => ({ status: statuses.ERROR, message: e.message }))

/********************
 * HELPER FUNCTIONS
 ********************/

// ({ Database, Socket, Array<PhoneNumberStatus> }) => Array<PhoneNumberStatus>
const registerBatch = async ({ sock, phoneNumberBatch }) =>
  sequence(
    phoneNumberBatch.map(phoneNumber => () => register({ sock, phoneNumber })),
    intervalBetweenRegistrations,
  )

// (Database, string, PhoneNumberStatus) -> PhoneNumberStatus
const recordStatusChange = (phoneNumber, status) =>
  phoneNumberRepository.update(phoneNumber, { status }).then(extractStatus)

// PhoneNumberStatus -> boolean
const isRegistered = async ({ status, phoneNumber }) => {
  const marked = status === pnStatuses.VERIFIED || status === pnStatuses.ACTIVE
  const inKeystore = await fs.pathExists(`${keystorePath}/${phoneNumber}`)
  return marked && inKeystore
}

// EXPORTS

module.exports = { registerMany, registerAllUnregistered, register, verify }
