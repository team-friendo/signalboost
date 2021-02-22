const moment = require('moment')
const fs = require('fs-extra')
const { map, flatMap, isEmpty, round } = require('lodash')
const app = require('../../index')
const common = require('./common')
const channelRepository = require('../../db/repositories/channel')
const destructionRequestRepository = require('../../db/repositories/destructionRequest')
const eventRepository = require('../../db/repositories/event')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const logger = require('../logger')
const notifier = require('../../notifier')
const signal = require('../../signal')
const util = require('../../util')
const { getAdminMemberships } = require('../../db/repositories/channel')
const { notificationKeys } = notifier
const { messagesIn } = require('../../dispatcher/strings/messages')
const { statuses, sequence } = require('../../util')
const { eventTypes } = require('../../db/models/event')
const {
  defaultLanguage,
  jobs: { channelDestructionGracePeriod },
  signal: { keystorePath },
} = require('../../config')
const { memberTypes } = require('../../db/repositories/membership')

const issuerTypes = {
  SYSTEM: 'SYSTEM',
  ADMIN: 'ADMIN',
}

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

        await notifier.notifyAdmins(channel, notificationKeys.CHANNEL_DESTRUCTION_SCHEDULED, [
          util.millisAs(channelDestructionGracePeriod, 'hours'),
        ])

        return {
          status: statuses.SUCCESS,
          message: `Issued request to destroy ${phoneNumber}.`,
        }
      } catch (err) {
        logger.error(err)
        return {
          status: statuses.ERROR,
          message: `Error trying to issue destruction request for ${phoneNumber}: ${err}`,
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
    const toNotify = await destructionRequestRepository.getNotifiableDestructionRequests()
    await _warnOfPendingDestruction(toNotify)

    // NOTE (2020-11-01|aguestuser):
    // - we call destroy in sequence (not parallel) to avoid contention over tx lock created by each call
    // - in future, we might consider refactoring to hold a single lock for all destroy calls in this job?
    const toDestroy = await destructionRequestRepository.getMatureDestructionRequests()
    const destructionResults = await sequence(
      toDestroy.map(({ channelPhoneNumber }) => () => destroy({ phoneNumber: channelPhoneNumber })),
    )
    await destructionRequestRepository.destroyMany(map(toDestroy, 'channelPhoneNumber'))

    if (isEmpty(toDestroy)) return null
    logger.log(
      `${toDestroy.length} destruction requests processed:\n\n` +
        `${map(destructionResults, 'message').join('\n')}`,
    )
  } catch (err) {
    logger.error(err)
    return notifier.notifyMaintainers(`Error processing destruction jobs: ${err}`)
  }
}

// Array<DestructionRequest> => Promise<number>
const _warnOfPendingDestruction = async destructionRequests => {
  const timestamp = util.nowTimestamp()
  await Promise.all(
    destructionRequests.map(({ createdAt, channel }) =>
      isEmpty(channel) || isEmpty(getAdminMemberships(channel))
        ? Promise.resolve() // TODO(aguestuser|12 Feb 2021): i owe a test for this bugfix!
        : notifier.notifyAdmins(channel, notificationKeys.CHANNEL_DESTRUCTION_SCHEDULED, [
            _hoursToLive(createdAt),
          ]),
    ),
  )
  return destructionRequestRepository.recordNotifications(
    timestamp,
    map(destructionRequests, 'channelPhoneNumber'),
  )
}

// string => number
const _hoursToLive = destructionRequestedAt => {
  // returns number of hours before a channel will be destroyed (rounded to nearest single decimal place)
  const requestMaturesAt = moment(destructionRequestedAt)
    .clone()
    .add(channelDestructionGracePeriod, 'ms')
  return round(requestMaturesAt.diff(util.now(), 'hours', true), 1)
}

// (Channel) -> Promise<void>
const redeem = async channel => {
  try {
    await destructionRequestRepository.destroy(channel.phoneNumber)
    await notifier.notifyAdmins(channel, notificationKeys.CHANNEL_REDEEMED)
    logger.log(`${channel.phoneNumber} had been scheduled for destruction, but was just redeemed.`)
  } catch (err) {
    return notifier.notifyMaintainers(`Error redeeming ${channel.phoneNumber}: ${err}`)
  }
}

// ({ phoneNumber: string, sender: Membership, notifyOnFailure: boolean, issuer: 'SYSTEM' | 'ADMIN'}) -> SignalboostStatus
const destroy = async ({ phoneNumber, sender, notifyOnFailure, issuer }) => {
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

      // it's important to not await channel destruction notifications because we might need to send out several thousand (which will take a long time!)
      // we don't want to block execution of the deletion job

      notifyMembersOfDeletion(channel, sender, issuer)
        .then(() => logger.log(`...sent deletion notice to members of: ${phoneNumber}.`))
        .catch(err =>
          logger.error(`... error sending deletion notices members of ${phoneNumber}: ${err}`),
        )

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

const notifyMembersOfDeletion = (channel, sender, issuer) =>
  issuer === issuerTypes.ADMIN
    ? Promise.all([
        notifier.notifyAdmins(channel, notificationKeys.CHANNEL_DESTROYED_BY_ADMIN, [
          memberTypes.ADMIN,
          sender.adminId,
        ]),
        notifier.notifySubscribers(channel, notificationKeys.CHANNEL_DESTROYED_BY_ADMIN, [
          memberTypes.SUBSCRIBER,
        ]),
      ]).catch(logger.error)
    : notifier.notifyMembersExcept(channel, sender, notificationKeys.CHANNEL_DESTROYED_BY_SYSTEM)

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
      messagesIn(defaultLanguage).notifications.channelDestructionFailed(phoneNumber, err),
    )
  return {
    status: 'ERROR',
    message: `Channel ${phoneNumber} failed to be destroyed. Error: ${err}`,
  }
}

module.exports = {
  deleteVestigalKeystoreEntries,
  destroy,
  issuerTypes,
  processDestructionRequests,
  redeem,
  requestToDestroy,
  requestToDestroyStaleChannels,
}
