const channelRepository = require('../../db/repositories/channel')
const eventRepository = require('../../db/repositories/event')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const recycleRequestRepository = require('../../db/repositories/recycleRequest')
const common = require('./common')
const { notificationKeys } = require('./common')
const { statuses } = require('../../util')
const { defaultLanguage } = require('../../config')
const { eventTypes } = require('../../db/models/event')
const { messagesIn } = require('../../dispatcher/strings/messages')

// (Array<string>) -> Promise<SignalboostStatus>
const requestToRecycle = async phoneNumbers => {
  return await Promise.all(
    phoneNumbers.map(async phoneNumber => {
      try {
        const channel = await channelRepository.findDeep(phoneNumber)
        if (!channel)
          return {
            status: statuses.ERROR,
            message: `${phoneNumber} must be associated with a channel in order to be recycled.`,
          }

        const { wasCreated } = await recycleRequestRepository.requestToRecycle(phoneNumber)
        if (!wasCreated)
          return {
            status: statuses.ERROR,
            message: `${phoneNumber} has already been enqueued for recycling.`,
          }

        await common.notifyAdmins(channel, 'channelEnqueuedForRecycling')

        return {
          status: statuses.SUCCESS,
          message: `Issued request to recycle ${phoneNumber}.`,
        }
      } catch (e) {
        return {
          status: statuses.ERROR,
          message: `Database error trying to issue recycle request for ${phoneNumber}.`,
        }
      }
    }),
  )
}

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

module.exports = { requestToRecycle, recycle }
