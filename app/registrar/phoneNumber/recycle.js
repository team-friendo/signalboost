const channelRepository = require('../../db/repositories/channel')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const recycleablePhoneNumberRepository = require('../../db/repositories/recycleablePhoneNumber')
const eventRepository = require('../../db/repositories/event')
const common = require('./common')
const { defaultLanguage } = require('../../config')
const signal = require('../../signal')
const { eventTypes } = require('../../db/models/event')
const { sdMessageOf } = require('../../signal/constants')
const { messagesIn } = require('../../dispatcher/strings/messages')

// ({ string }) -> SignalboostStatus
const enqueueRecycleablePhoneNumber = async ({ phoneNumbers }) => {
  return await Promise.all(
    phoneNumbers.split(',').map(async phoneNumber => {
      try {
        const channel = await channelRepository.find(phoneNumber)
        return recycleablePhoneNumberRepository.enqueue(channel.phoneNumber)
      } catch (e) {
        return { status: 'ERROR', message: `Channel not found for ${phoneNumber}` }
      }
    }),
  )
}

// (string) -> SignalboostStatus
const recycle = async channelPhoneNumber => {
  const channel = await channelRepository.findDeep(channelPhoneNumber)
  if (channel) {
    return notifyMembers(channel)
      .then(() => common.destroyChannel(channel))
      .then(() => eventRepository.log(eventTypes.CHANNEL_DESTROYED, channelPhoneNumber))
      .then(() => recordStatusChange(channelPhoneNumber, common.statuses.VERIFIED))
      .then(phoneNumberStatus => ({ status: 'SUCCESS', data: phoneNumberStatus }))
      .catch(err => handleRecycleFailure(err, channelPhoneNumber))
  } else {
    return { status: 'ERROR', message: `Channel not found for ${channelPhoneNumber}` }
  }
}

/********************
 * HELPER FUNCTIONS
 ********************/
// (Channel) -> Channel
const notifyMembers = async channel => {
  const memberPhoneNumbers = channelRepository.getMemberPhoneNumbers(channel)
  await signal.broadcastMessage(
    memberPhoneNumbers,
    sdMessageOf(channel, channelRecycledNotification),
  )
}

// String
const channelRecycledNotification = messagesIn(defaultLanguage).notifications.channelRecycled

// (Database, string, PhoneNumberStatus) -> PhoneNumberStatus
const recordStatusChange = async (phoneNumber, status) =>
  phoneNumberRepository.update(phoneNumber, { status }).then(common.extractStatus)

const handleRecycleFailure = async (err, phoneNumber) => {
  await common.notifyMaintainers(
    messagesIn(defaultLanguage).notifications.recycleChannelFailed(phoneNumber),
  )

  return {
    status: 'ERROR',
    message: `Failed to recycle channel for ${phoneNumber}. Error: ${err}`,
  }
}

module.exports = { enqueueRecycleablePhoneNumber, recycle }
