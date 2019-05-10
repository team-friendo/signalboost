const fs = require('fs-extra')
const { errors, statuses, errorStatus, extractStatus } = require('./common')
const { flatten, without } = require('lodash')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const signal = require('../signal')
const { loggerOf, sequence, batchesOfN } = require('../util')
const logger = loggerOf('FIXME')
const {
  signal: {
    keystorePath,
    registrationBatchSize,
    intervalBetweenRegistrationBatches,
    intervalBetweenRegistrations,
  },
} = require('../../config/index')

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

// ({Database, Socket, object}) => Promise<Array<PhoneNumberStatus>>
const registerAllPurchased = async ({ db, sock }) => {
  const phoneNumberStatuses = await phoneNumberRepository.findAllPurchased(db)
  return registerInBatches({ db, sock, phoneNumberStatuses })
}

// ({Database, Emitter, object }) => Promise<Array<PhoneNumberStatus>>
const registerAllUnregistered = async ({ db, sock }) => {
  const allStatuses = await phoneNumberRepository.findAll(db)
  // this is awkward but filtering on promises is hard!
  const unregisteredStatuses = without(
    await Promise.all(allStatuses.map(async s => ((await isRegistered(s)) ? null : s))),
    null,
  )
  return registerInBatches({ db, sock, phoneNumberStatuses: unregisteredStatuses })
}

// ({Database, Emitter, string, string}) => Promise<Boolean>
const verify = ({ sock, phoneNumber, verificationMessage }) =>
  signal
    .verify(sock, phoneNumber, signal.parseVerificationCode(verificationMessage))
    .then(() => signal.awaitVerificationResult(sock, phoneNumber))

/********************
 * HELPER FUNCTIONS
 ********************/

const registerInBatches = async ({ db, sock, phoneNumberStatuses }) => {
  const statusBatches = batchesOfN(phoneNumberStatuses, registrationBatchSize)
  return flatten(
    await sequence(
      statusBatches.map(phoneNumberStatuses => () =>
        registerBatch({ db, sock, phoneNumberStatuses }),
      ),
      intervalBetweenRegistrationBatches,
    ),
  )
}

const registerBatch = async ({ db, sock, phoneNumberStatuses }) =>
  sequence(
    phoneNumberStatuses.map(({ phoneNumber }) => () => register({ db, sock, phoneNumber })),
    intervalBetweenRegistrations,
  )

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

const recordStatusChange = (db, phoneNumber, status) =>
  phoneNumberRepository.update(db, phoneNumber, { status }).then(extractStatus)

const isRegistered = async phoneNumberStatus => {
  const marked = phoneNumberStatus.status === statuses.VERIFIED
  const inKeystore = await fs.pathExists(`${keystorePath}/${phoneNumberStatus.phoneNumber}`)
  return marked && inKeystore
}

// EXPORTS

module.exports = { registerAllUnregistered, registerAllPurchased, register, verify }
