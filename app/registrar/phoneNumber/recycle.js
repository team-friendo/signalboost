const channelRepository = require('../../db/repositories/channel')
const eventRepository = require('../../db/repositories/event')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const common = require('./common')
const { notificationKeys } = require('./common')
const { statuses } = require('../../util')
const { defaultLanguage } = require('../../config')
const { eventTypes } = require('../../db/models/event')
const { messagesIn } = require('../../dispatcher/strings/messages')

// (string) -> SignalboostStatus
const recycle = async phoneNumber => {
  const channel = await channelRepository.findDeep(phoneNumber)
  if (!channel) return { status: statuses.ERROR, message: `Channel not found for ${phoneNumber}` }

  try {
    await common.notifyMembers(channel, notificationKeys.CHANNEL_RECYCLED)
    await channelRepository.destroy(channel)
    await eventRepository.log(eventTypes.CHANNEL_DESTROYED, phoneNumber)
    const result = await phoneNumberRepository.update(phoneNumber, {
      status: common.statuses.VERIFIED,
    })

    return {
      status: statuses.SUCCESS,
      data: common.extractStatus(result),
    }
  } catch (err) {
    await common.notifyMaintainers(
      messagesIn(defaultLanguage).notifications.recycleChannelFailed(phoneNumber),
    )
    return {
      status: 'ERROR',
      message: `Failed to recycle channel for ${phoneNumber}. Error: ${err}`,
    }
  }
}

module.exports = { recycle }
