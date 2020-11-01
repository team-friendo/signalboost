const fs = require('fs-extra')
const { map, flatMap } = require('lodash')
const app = require('../../index')
const common = require('./common')
const channelRepository = require('../../db/repositories/channel')
const destructionRequestRepository = require('../../db/repositories/destructionRequest')
const eventRepository = require('../../db/repositories/event')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const logger = require('../logger')
const notifier = require('../../notifier')
const signal = require('../../signal')
const { notificationKeys } = notifier
const { messagesIn } = require('../../dispatcher/strings/messages')
const { statuses, sequence } = require('../../util')
const { eventTypes } = require('../../db/models/event')
const {
  defaultLanguage,
  signal: { keystorePath },
} = require('../../config')

// (Array<string>) -> Promise<SignalboostStatus>
const requestToDestroy = async phoneNumbers => {
  return await Promise.all(
    phoneNumbers.map(async phoneNumber => {
      try {
        const channel = await channelRepository.findDeep(phoneNumber)
        if (!channel)
          return {
            status: statuses.ERROR,
            message: `${phoneNumber} must be associated with a channel in order to be destroyed.`,
          }

        const { wasCreated } = await destructionRequestRepository.findOrCreate(phoneNumber)
        if (!wasCreated)
          return {
            status: statuses.ERROR,
            message: `${phoneNumber} has already been enqueued for destruction.`,
          }

        await notifier.notifyAdmins(channel, 'channelEnqueuedForDestruction')

        return {
          status: statuses.SUCCESS,
          message: `Issued request to destroy ${phoneNumber}.`,
        }
      } catch (e) {
        return {
          status: statuses.ERROR,
          message: `Database error trying to issue destruction request for ${phoneNumber}.`,
        }
      }
    }),
  )
}

// () => Promise<SignalboostStatus>
const requestToDestroyStaleChannels = async () => {
  const staleChannelPhoneNumbers = map(await channelRepository.getStaleChannels(), 'phoneNumber')
  return requestToDestroy(staleChannelPhoneNumbers)
}

// () -> Promise<Array<string>>
const processDestructionRequests = async () => {
  try {
    const phoneNumbersToDestroy = await destructionRequestRepository.getMatureDestructionRequests()
    // NOTE (2020-11-01|aguestuser):
    // - we (somewhat wastefully) process each job in sequence rather than in parallel
    //   to avoid contention over tx lock created by each destroy call
    // - in future, we might consider refactoring to hold a single lock for destroy calls in this job?
    const destructionResults = await sequence(
      phoneNumbersToDestroy.map(phoneNumber => () => destroy({ phoneNumber })),
    )
    await destructionRequestRepository.destroyMany(phoneNumbersToDestroy)

    return Promise.all([
      phoneNumbersToDestroy.length === 0
        ? Promise.resolve()
        : notifier.notifyMaintainers(
            `${phoneNumbersToDestroy.length} destruction requests processed:\n\n` +
              `${map(destructionResults, 'message').join('\n')}`,
          ),
    ])
  } catch (err) {
    return notifier.notifyMaintainers(`Error processing destruction jobs: ${err}`)
  }
}

// (Channel) -> Promise<void>
const redeem = async channel => {
  try {
    await destructionRequestRepository.destroy(channel.phoneNumber)
    await Promise.all([
      notifier.notifyAdmins(channel, notificationKeys.CHANNEL_REDEEMED),
      notifier.notifyMaintainers(
        `${channel.phoneNumber} had been scheduled for destruction, but was just redeemed.`,
      ),
    ])
  } catch (err) {
    return notifier.notifyMaintainers(`Error redeeming ${channel.phoneNumber}: ${err}`)
  }
}

// ({ phoneNumber: string, sender: string, notifyOnFailure: boolean }) -> SignalboostStatus
const destroy = async ({ phoneNumber, sender, notifyOnFailure }) => {
  const tx = await app.db.sequelize.transaction()

  try {
    const channel = await channelRepository.findDeep(phoneNumber)
    const phoneNumberRecord = await phoneNumberRepository.find(phoneNumber)

    if (!channel && !phoneNumberRecord)
      return { status: 'ERROR', message: `No records found for ${phoneNumber}` }

    if (phoneNumberRecord) {
      logger.log(`deleting phone number ${phoneNumber}...`)
      await phoneNumberRepository.destroy(phoneNumber, tx)
      await releasePhoneNumber(phoneNumberRecord)
      logger.log(`...deleted phone number ${phoneNumber}.`)
    }

    if (channel) {
      logger.log(`deleting channel ${phoneNumber}...`)
      await channelRepository.destroy(channel.phoneNumber, tx)
      logger.log(`...deleted channel ${phoneNumber}`)

      logger.log(`logging destruction of ${phoneNumber}...`)
      await eventRepository.log(eventTypes.CHANNEL_DESTROYED, phoneNumber, tx)
      logger.log(`...logged destruction of ${phoneNumber}`)

      logger.log(`sending deletion notice to members of: ${phoneNumber} in background...`)
      notifier
        .notifyMembersExcept(channel, sender, notificationKeys.CHANNEL_DESTROYED)
        .then(() => logger.log(`...sent deletion notice to members of: ${phoneNumber}.`))
        .catch(logger.error)

      logger.log(`unsubscribing from ${phoneNumber}...`)
      await signal.unsubscribe(phoneNumber, channel.socketId)
      logger.log(`unsubscribed from ${phoneNumber}.`)
    }

    logger.log(`destroying signald data for ${phoneNumber}...`)
    await deleteSignalKeystore(phoneNumber)
    logger.log(`destroyed signald data for ${phoneNumber}.`)

    await tx.commit()
    return {
      status: 'SUCCESS',
      message: `Channel ${phoneNumber} destroyed.`,
    }
  } catch (err) {
    await tx.rollback()
    return handleDestroyFailure(err, phoneNumber, notifyOnFailure)
  }
}

// () => Promise(number)
const deleteVestigalKeystoreEntries = async () => {
  // deletes all signald keystore entries for phone numbers no longer in use
  try {
    const allEntries = await fs.readdir(keystorePath)
    const whiteListedEntries = new Set(
      flatMap(await phoneNumberRepository.findAll(), p => [p.phoneNumber, `${p.phoneNumber}.d`]),
    )
    const entriesToDelete = allEntries.filter(fileName => !whiteListedEntries.has(fileName))
    await Promise.all(entriesToDelete.map(fileName => fs.remove(`${keystorePath}/${fileName}`)))
    return entriesToDelete.length
  } catch (e) {
    logger.error(`Failed to delete all keystore entries: ${e}`)
  }
}

// HELPERS

// (string) -> Promise<void>
const deleteSignalKeystore = async phoneNumber => {
  try {
    await fs.remove(`${keystorePath}/${phoneNumber}`)
    await fs.remove(`${keystorePath}/${phoneNumber}.d`)
  } catch (error) {
    return Promise.reject('Failed to destroy signal entry data in keystore')
  }
}

// (PhoneNumberInstance) -> Promise<void>
const releasePhoneNumber = async phoneNumberRecord => {
  try {
    const twilioClient = common.getTwilioClient()
    await twilioClient.incomingPhoneNumbers(phoneNumberRecord.twilioSid).remove()
  } catch (error) {
    return error.status === 404
      ? Promise.resolve()
      : Promise.reject(`Failed to release phone number back to Twilio: ${JSON.stringify(error)}`)
  }
}

// (Error, string, notifyOnFailure) -> SignalboostStatus
const handleDestroyFailure = async (err, phoneNumber, notifyOnFailure = false) => {
  logger.error(`Error destroying channel: ${phoneNumber}:`)
  logger.error(err)
  if (notifyOnFailure)
    await notifier.notifyMaintainers(
      messagesIn(defaultLanguage).notifications.channelDestructionFailed(phoneNumber),
    )
  return {
    status: 'ERROR',
    message: `Channel ${phoneNumber} failed to be destroyed. Error: ${err}`,
  }
}

module.exports = {
  deleteVestigalKeystoreEntries,
  destroy,
  processDestructionRequests,
  redeem,
  requestToDestroy,
  requestToDestroyStaleChannels,
}
