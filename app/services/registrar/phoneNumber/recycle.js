const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const { statuses, extractStatus } = require('./common')
const { defaultLanguage } = require('../../../config')
const signal = require('../../signal')
const { messagesIn } = require('../../dispatcher/strings/messages')
const channelRepository = require('../../../db/repositories/channel')
const { signal: signalConfig } = require('../../../config')

// ({Database, Socket, string}) -> SignalboostStatus
const recycle = async ({ db, sock, phoneNumbers }) => {
  return await Promise.all(
    phoneNumbers.split(',').map(async phoneNumber => {
      const channel = await channelRepository.findDeep(db, phoneNumber)

      if (channel) {
        return notifyMembers(db, sock, channel)
          .then(() => destroyChannel(db, sock, channel))
          .then(() => recordStatusChange(db, phoneNumber, statuses.VERIFIED))
          .then(phoneNumberStatus => ({ status: 'SUCCESS', data: phoneNumberStatus }))
          .catch(err => handleRecycleFailure(err, phoneNumber))
      } else {
        return { status: 'ERROR', message: `Channel not found for ${phoneNumber}` }
      }
    }),
  )
}

/********************
 * HELPER FUNCTIONS
 ********************/
// (Database, Socket, Channel) -> Channel
const notifyMembers = async (db, sock, channel) => {
  const memberPhoneNumbers = channelRepository.getMemberPhoneNumbers(channel)
  await signal.broadcastMessage(
    sock,
    memberPhoneNumbers,
    signal.sdMessageOf(channel, channelRecycledNotification),
  )
}

// String
const channelRecycledNotification = messagesIn(defaultLanguage).notifications.channelRecycled

// Channel -> Promise<void>
const destroyChannel = async (db, sock, channel) => {
  try {
    await channel.destroy()
  } catch (error) {
    await notifyMaintainersOfDestructionFailure(db, sock, channel)
    await Promise.reject('Failed to destroy channel')
  }
}

// String
const recycleChannelFailureNotification = channel =>
  messagesIn(defaultLanguage).notifications.recycleChannelFailed(channel.phoneNumber)

// Channel -> Promise<void>
const notifyMaintainersOfDestructionFailure = async (db, sock, channel) => {
  const adminChannel = await channelRepository.findDeep(db, signalConfig.signupPhoneNumber)
  const adminPhoneNumbers = channelRepository.getAdminPhoneNumbers(adminChannel)

  await signal.broadcastMessage(
    sock,
    adminPhoneNumbers,
    signal.sdMessageOf(adminChannel, recycleChannelFailureNotification(channel)),
  )
}

// (Database, string, PhoneNumberStatus) -> PhoneNumberStatus
const recordStatusChange = async (db, phoneNumber, status) =>
  phoneNumberRepository.update(db, phoneNumber, { status }).then(extractStatus)

const handleRecycleFailure = (err, phoneNumber) => ({
  status: 'ERROR',
  message: `Failed to recycle channel for ${phoneNumber}. Error: ${err}`,
})

module.exports = { recycle }
