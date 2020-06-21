const app = require('../../../../app')
const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const { defaultLanguage } = require('../../../config')
const { notifyMembersExcept, destroyChannel } = require('./common')
const common = require('./common')
const signal = require('../../signal')
const { messagesIn } = require('../../dispatcher/strings/messages')
const channelRepository = require('../../../db/repositories/channel')
const logger = require('../logger')
const fs = require('fs-extra')
const {
  signal: { keystorePath },
} = require('../../../config')

// ({Database, Socket, string}) -> SignalboostStatus
const destroy = async ({ phoneNumber, sender }) => {
  let tx = await app.db.sequelize.transaction()
  try {
    const channelInstance = await channelRepository.findDeep(phoneNumber)
    const phoneNumberInstance = await phoneNumberRepository.find(phoneNumber)

    if (channelInstance || phoneNumberInstance) {
      await destroyChannel(channelInstance, tx)
      await destroyPhoneNumber(phoneNumberInstance, tx)
      await signal.unsubscribe(phoneNumber)
      await destroySignalEntry(phoneNumber)
      await releasePhoneNumber(phoneNumberInstance)
      await notifyMembersExcept(
        channelInstance,
        messagesIn(defaultLanguage).notifications.channelDestroyed,
        sender,
      )
      await tx.commit()
      return { status: 'SUCCESS', msg: 'All records of phone number have been destroyed.' }
    } else {
      return { status: 'ERROR', message: `No records found for ${phoneNumber}` }
    }
  } catch (err) {
    await tx.rollback()
    return handleDestroyFailure(err, phoneNumber)
  }
}

// HELPERS

// (DB, string) -> Promise<void>
const destroySignalEntry = async phoneNumber => {
  try {
    await fs.remove(`${keystorePath}/${phoneNumber}`)
    await fs.remove(`${keystorePath}/${phoneNumber}.d`)
  } catch (error) {
    return Promise.reject('Failed to destroy signal entry data in keystore')
  }
}

// (PhoneNumberInstance) -> Promise<void>
const releasePhoneNumber = async phoneNumberInstance => {
  try {
    const twilioClient = common.getTwilioClient()
    await twilioClient.incomingPhoneNumbers(phoneNumberInstance.twilioSid).remove()
  } catch (error) {
    return error.status === 404
      ? Promise.resolve()
      : Promise.reject('Failed to release phone number back to Twilio')
  }
}

// Channel -> Promise<void>
const destroyPhoneNumber = async (phoneNumberInstance, tx) => {
  if (phoneNumberInstance == null) return
  try {
    await phoneNumberInstance.destroy({ transaction: tx })
  } catch (error) {
    await Promise.reject('Failed to destroy phoneNumber in db')
  }
}

// (String, DB, Socket, String) -> SignalboostStatus
const handleDestroyFailure = async (err, phoneNumber) => {
  logger.log(`Error destroying channel: ${phoneNumber}:`)
  logger.error(err)
  await common.notifyMaintainers(
    messagesIn(defaultLanguage).notifications.channelDestructionFailed(phoneNumber),
  )

  return {
    status: 'ERROR',
    message: `Failed to destroy channel for ${phoneNumber}. Error: ${err}`,
  }
}

module.exports = { destroy }
