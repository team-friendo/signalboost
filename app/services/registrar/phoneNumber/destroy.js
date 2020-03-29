const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const { defaultLanguage } = require('../../../config')
const { notifyMembersExcept, destroyChannel } = require('./common')
const common = require('./common')
const signal = require('../../signal')
const { messagesIn } = require('../../dispatcher/strings/messages')
const channelRepository = require('../../../db/repositories/channel')
const del = require('del')
const logger = require('../logger')
const {
  signal: { keystorePath },
} = require('../../../config')

// ({Database, Socket, string}) -> SignalboostStatus
const destroy = async ({ db, sock, phoneNumber, sender }) => {
  const channelInstance = await channelRepository.findDeep(db, phoneNumber)
  const phoneNumberInstance = await phoneNumberRepository.find(db, phoneNumber)

  if (channelInstance || phoneNumberInstance) {
    return notifyMembersExcept(
      db,
      sock,
      channelInstance,
      messagesIn(defaultLanguage).notifications.channelDestroyed,
      sender,
    )
      .then(() =>
        destroyChannel(
          db,
          sock,
          channelInstance,
          messagesIn(defaultLanguage).notifications.channelDestructionFailed(phoneNumber),
        ),
      )
      .then(() => destroyPhoneNumber(db, sock, phoneNumberInstance))
      .then(() => destroySignalEntry(db, phoneNumber))
      .then(() => releasePhoneNumber(db, phoneNumberInstance))
      .then(() => signal.unsubscribe(sock, phoneNumber))
      .then(() => ({ status: 'SUCCESS', msg: 'All records of phone number have been destroyed.' }))
      .catch(err => handleDestroyFailure(err, phoneNumber))
  } else {
    return { status: 'ERROR', message: `No records found for ${phoneNumber}` }
  }
}

// HELPERS

// (DB, string) -> Promise<void>
const destroySignalEntry = async (db, phoneNumber) => {
  try {
    del.sync(`${keystorePath}/${phoneNumber}*`, { force: true })
  } catch (error) {
    return Promise.reject('Failed to destroy signal entry data in keystore')
  }
}

// (DB, PhoneNumberInstance) -> Promise<void>
const releasePhoneNumber = async (db, phoneNumberInstance) => {
  try {
    const twilioClient = common.getTwilioClient()
    await twilioClient.incomingPhoneNumbers(phoneNumberInstance.twilioSid).remove()
  } catch (error) {
    return Promise.reject('Failed to release phone number back to Twilio')
  }
}

// Channel -> Promise<void>
const destroyPhoneNumber = async (db, sock, phoneNumberInstance) => {
  try {
    await phoneNumberInstance.destroy()
  } catch (error) {
    await Promise.reject('Failed to destroy phoneNumber in db')
  }
}

// (String, String) -> SignalboostStatus
const handleDestroyFailure = (err, phoneNumber) => {
  logger.log(`Error destroying channel: ${phoneNumber}:`)
  logger.error(err)
  return {
    status: 'ERROR',
    message: `Failed to destroy channel for ${phoneNumber}. Error: ${err}`,
  }
}

module.exports = { destroy }
