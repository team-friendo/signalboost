const fs = require('fs-extra')
const { errors, statuses, errorStatus, extractStatus } = require('./common')
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
const registerMany = async ({ db, sock, phoneNumbers }) => {
  const phoneNumberBatches = batchesOfN(phoneNumbers, registrationBatchSize)
  return flatten(
    await sequence(
      phoneNumberBatches.map(phoneNumberBatch => () =>
        registerBatch({ db, sock, phoneNumberBatch }),
      ),
      intervalBetweenRegistrationBatches,
    ),
  )
}

// ({Database, Socket }) => Promise<Array<PhoneNumberStatus>>
const registerAllUnregistered = async ({ db, sock }) => {
  const allStatuses = await phoneNumberRepository.findAll(db)
  // this is a bit awkward but necessary b/c we can't just map/filter w/ Promises
  const unregisteredPhoneNumbers = without(
    await Promise.all(allStatuses.map(async s => ((await isRegistered(s)) ? null : s.phoneNumber))),
    null,
  )
  return registerMany({ db, sock, phoneNumbers: unregisteredPhoneNumbers })
}

// ({Database, Socket, string}) => Promise<PhoneNumberStatus>
const register = ({ db, sock, phoneNumber }) =>
  signal
    .register(sock, phoneNumber)
    .then(() => recordStatusChange(db, phoneNumber, statuses.REGISTERED))
    .then(() => signal.awaitVerificationResult(sock, phoneNumber))
    .then(() => recordStatusChange(db, phoneNumber, statuses.VERIFIED))
    .catch(err => {
      // TODO(@zig): add prometheus error count here (counter: signal_register_error)
      logger.error(err)
      return errorStatus(errors.registrationFailed(err), phoneNumber)
    })

// ({Database, Emitter, string, string}) => Promise<Boolean>
const verify = ({ sock, phoneNumber, verificationMessage }) => {
  const [ok, verificationCode] = signal.parseVerificationCode(verificationMessage)
  if (!ok) {
    // handled rejections from #verify only ever wind up in HTTP responses to twillio,
    // so we don't reject with the error message (which we don't wish to expose to twillio)
    logger.log(errors.invalidIncomingSms(phoneNumber, verificationMessage))
    return Promise.reject()
  }
  return signal
    .verify(sock, phoneNumber, verificationCode)
    .then(() => signal.awaitVerificationResult(sock, phoneNumber))
}

/********************
 * HELPER FUNCTIONS
 ********************/

// ({ Database, Socket, Array<PhoneNumberStatus> }) => Array<PhoneNumberStatus>
const registerBatch = async ({ db, sock, phoneNumberBatch }) =>
  sequence(
    phoneNumberBatch.map(phoneNumber => () => register({ db, sock, phoneNumber })),
    intervalBetweenRegistrations,
  )

// (Database, string, PhoneNumberStatus) -> PhoneNumberStatus
const recordStatusChange = (db, phoneNumber, status) =>
  phoneNumberRepository.update(db, phoneNumber, { status }).then(extractStatus)

// PhoneNumberStatus -> boolean
const isRegistered = async ({ status, phoneNumber }) => {
  const marked = status === statuses.VERIFIED || status === statuses.ACTIVE
  const inKeystore = await fs.pathExists(`${keystorePath}/${phoneNumber}`)
  return marked && inKeystore
}

// EXPORTS

module.exports = { registerMany, registerAllUnregistered, register, verify }
