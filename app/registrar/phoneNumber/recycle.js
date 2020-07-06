const eventRepository = require('../../db/repositories/event')
const common = require('./common')
const { statuses } = require('../../util')
const { defaultLanguage } = require('../../config')
const signal = require('../../signal')
const { eventTypes } = require('../../db/models/event')
const { messagesIn } = require('../../dispatcher/strings/messages')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const channelRepository = require('../../db/repositories/channel')

// (string) -> SignalboostStatus
const recycle = async channelPhoneNumber => {
  const channel = await channelRepository.findDeep(channelPhoneNumber)
  if (channel) {
    return notifyMembers(channel)
      .then(() => common.destroyChannel(channel))
      .then(() => eventRepository.log(eventTypes.CHANNEL_DESTROYED, channelPhoneNumber))
      .then(() => recordStatusChange(channelPhoneNumber, common.statuses.VERIFIED))
      .then(phoneNumberStatus => ({ status: statuses.SUCCESS, data: phoneNumberStatus }))
      .catch(err => handleRecycleFailure(err, channelPhoneNumber))
  } else {
    return { status: statuses.ERROR, message: `Channel not found for ${channelPhoneNumber}` }
  }
}

/********************
 * HELPER FUNCTIONS
 ********************/
// TODO @mari - convert these functions to use sendMessage in language per membership
// (Channel) -> Channel
const notifyMembers = async channel => {
  await signal.broadcastMessage(
    channelRepository.getMemberPhoneNumbers(channel),
    signal.sdMessageOf(channel, messagesIn(channel.language).notifications.channelRecycled),
  )
}

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

module.exports = { recycle }
