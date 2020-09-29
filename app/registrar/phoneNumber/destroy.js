const app = require('../../index')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const { defaultLanguage } = require('../../config')
const common = require('./common')
const notifier = require('../../notifier')
const { notificationKeys } = notifier
const signal = require('../../signal')
const { messagesIn } = require('../../dispatcher/strings/messages')
const channelRepository = require('../../db/repositories/channel')
const eventRepository = require('../../db/repositories/event')
const logger = require('../logger')
const fs = require('fs-extra')

const { eventTypes } = require('../../db/models/event')
const {
  signal: { keystorePath },
} = require('../../config')

// ({phoneNumber: string, sender?: string }) -> SignalboostStatus
const destroy = async ({ phoneNumber, sender }) => {
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
      await signal.unsubscribe(phoneNumber, channel.socketPoolId)
      logger.log(`unsubscribed from ${phoneNumber}.`)
    }

    logger.log(`destroying signald data for ${phoneNumber}...`)
    await deleteSignalKeystore(phoneNumber)
    logger.log(`destroyed signald data for ${phoneNumber}.`)

    await tx.commit()
    return { status: 'SUCCESS', msg: 'All records of phone number have been destroyed.' }
  } catch (err) {
    await tx.rollback()
    return handleDestroyFailure(err, phoneNumber)
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

// (Error, string) -> SignalboostStatus
const handleDestroyFailure = async (err, phoneNumber) => {
  logger.log(`Error destroying channel: ${phoneNumber}:`)
  logger.error(err)
  await notifier.notifyMaintainers(
    messagesIn(defaultLanguage).notifications.channelDestructionFailed(phoneNumber),
  )
  return {
    status: 'ERROR',
    message: `Failed to destroy channel for ${phoneNumber}. Error: ${err}`,
  }
}

module.exports = { destroy }
