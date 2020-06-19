const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const common = require('./common')
const { defaultLanguage } = require('../../../config')
const signal = require('../../signal')
const { messagesIn } = require('../../dispatcher/strings/messages')
const channelRepository = require('../../../db/repositories/channel')

// ({Database, Socket, string}) -> SignalboostStatus
const recycle = async ({ sock, phoneNumbers }) => {
  return await Promise.all(
    phoneNumbers.split(',').map(async phoneNumber => {
      const channel = await channelRepository.findDeep(phoneNumber)

      if (channel) {
        return notifyMembers(sock, channel)
          .then(() => common.destroyChannel(channel))
          .then(() => recordStatusChange(phoneNumber, common.statuses.VERIFIED))
          .then(phoneNumberStatus => ({ status: 'SUCCESS', data: phoneNumberStatus }))
          .catch(err => handleRecycleFailure(err, sock, phoneNumber))
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
const notifyMembers = async (sock, channel) => {
  const memberPhoneNumbers = channelRepository.getMemberPhoneNumbers(channel)
  await signal.broadcastMessage(
    sock,
    memberPhoneNumbers,
    signal.sdMessageOf(channel, channelRecycledNotification),
  )
}

// String
const channelRecycledNotification = messagesIn(defaultLanguage).notifications.channelRecycled

// (Database, string, PhoneNumberStatus) -> PhoneNumberStatus
const recordStatusChange = async (phoneNumber, status) =>
  phoneNumberRepository.update(phoneNumber, { status }).then(common.extractStatus)

const handleRecycleFailure = async (err, sock, phoneNumber) => {
  await common.notifyMaintainers(
    sock,
    messagesIn(defaultLanguage).notifications.recycleChannelFailed(phoneNumber),
  )

  return {
    status: 'ERROR',
    message: `Failed to recycle channel for ${phoneNumber}. Error: ${err}`,
  }
}

module.exports = { recycle }
