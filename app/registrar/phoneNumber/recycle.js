const channelRepository = require('../../db/repositories/channel')
const eventRepository = require('../../db/repositories/event')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const recycleRequestRepository = require('../../db/repositories/recycleRequest')
const common = require('./common')
const notifier = require('../../notifier')
const { notificationKeys } = notifier
const { statuses } = require('../../util')
const { eventTypes } = require('../../db/models/event')
const { map } = require('lodash')

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

        await notifier.notifyAdmins(channel, 'channelEnqueuedForRecycling')

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

// () -> Promise<Array<string>>
const processRecycleRequests = async () => {
  try {
    const { redeemed, toRecycle } = await recycleRequestRepository.evaluateRecycleRequests()
    const recycleResults = await Promise.all(toRecycle.map(recycle))
    await recycleRequestRepository.destroyMany([...redeemed, ...toRecycle])
    const redeemedChannels = await channelRepository.findManyDeep(redeemed)
    const numProcessed = redeemed.length + toRecycle.length

    return Promise.all([
      ...redeemedChannels.map(channel =>
        notifier.notifyAdmins(channel, notificationKeys.CHANNEL_REDEEMED),
      ),
      numProcessed === 0
        ? Promise.resolve()
        : notifier.notifyMaintainers(
            `${redeemed.length + toRecycle.length} recycle requests processed:\n\n` +
              `${redeemed.map(r => `${r} redeemed by admins.`).join('\n')}` +
              '\n' +
              `${map(recycleResults, 'message').join('\n')}`,
          ),
    ])
  } catch (err) {
    return notifier.notifyMaintainers(`Error processing recycle job: ${err}`)
  }
}

// (string) -> SignalboostStatus
const recycle = async phoneNumber => {
  const channel = await channelRepository.findDeep(phoneNumber)
  if (!channel) return { status: statuses.ERROR, message: `Channel not found for ${phoneNumber}` }

  try {
    await notifier.notifyMembers(channel, notificationKeys.CHANNEL_RECYCLED)
    await channelRepository.destroy(channel.phoneNumber)
    await eventRepository.log(eventTypes.CHANNEL_DESTROYED, phoneNumber)
    await phoneNumberRepository.update(phoneNumber, { status: common.statuses.VERIFIED })
    return {
      status: statuses.SUCCESS,
      message: `${phoneNumber} recycled.`,
    }
  } catch (err) {
    return {
      status: 'ERROR',
      message: `${phoneNumber} failed to be recycled. Error: ${err}`,
    }
  }
}

module.exports = { requestToRecycle, processRecycleRequests, recycle }
