const eventRepository = require('../../db/repositories/event')
const common = require('./common')
const { isEmpty } = require('lodash')
const { statuses } = require('../../util')
const { defaultLanguage } = require('../../config')
const signal = require('../../signal')
const { eventTypes } = require('../../db/models/event')
const { messagesIn } = require('../../dispatcher/strings/messages')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const { findByPhoneNumber, enqueue } = require('../../db/repositories/recycleablePhoneNumber')
const channelRepository = require('../../db/repositories/channel')

// ({ string }) -> SignalboostStatus
const enqueueRecycleablePhoneNumber = async ({ phoneNumbers }) => {
  return await Promise.all(
    phoneNumbers.split(',').map(async phoneNumber => {
      try {
        const channel = await channelRepository.findDeep(phoneNumber)
        if (isEmpty(channel))
          return {
            status: statuses.ERROR,
            message: `${phoneNumber} must be associated with a channel in order to be recycled.`,
          }

        const recycleablePhoneNumber = await findByPhoneNumber(phoneNumber)

        if (!isEmpty(recycleablePhoneNumber))
          return {
            status: statuses.ERROR,
            message: `${phoneNumber} has already been enqueued for recycling.`,
          }
        // notifyAdmins(channel)
        await enqueue(channel.phoneNumber)
        return {
          status: statuses.SUCCESS,
          message: `Successfully enqueued ${phoneNumber} for recycling.`,
        }
      } catch (e) {
        return {
          status: statuses.ERROR,
          message: `There was an error trying to enqueue ${phoneNumber} for recycling.`,
        }
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

const notifyAdmins = async channel => {
  await signal.broadcastMessage(
    channelRepository.getAdminPhoneNumbers(channel),
    signal.sdMessageOf(
      channel,
      messagesIn(channel.language).notifications.channelEnqueuedForRecycling,
    ),
  )
}

// String

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
