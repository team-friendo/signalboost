const channelRepository = require('../../db/repositories/channel')
const eventRepository = require('../../db/repositories/event')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const destructionRequestRepository = require('../../db/repositories/destructionRequest')
const common = require('./common')
const notifier = require('../../notifier')
const { notificationKeys } = notifier
const { statuses } = require('../../util')
const { eventTypes } = require('../../db/models/event')
const { map } = require('lodash')

// (Array<string>) -> Promise<SignalboostStatus>
const requestToDestroy = async phoneNumbers => {
  return await Promise.all(
    phoneNumbers.map(async phoneNumber => {
      try {
        const channel = await channelRepository.findDeep(phoneNumber)
        if (!channel)
          return {
            status: statuses.ERROR,
            message: `${phoneNumber} must be associated with a channel in order to be destroyed.`,
          }

        const { wasCreated } = await destructionRequestRepository.requestToDestroy(phoneNumber)
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
          message: `Database error trying to issue destruction request for ${phoneNumber}.`,
        }
      }
    }),
  )
}

// () -> Promise<Array<string>>
const processDestructionRequests = async () => {
  try {
    const phoneNumbersToDestroy = await destructionRequestRepository.getMatureDestructionRequests()
    const destructionResults = await Promise.all(phoneNumbersToDestroy.map(recycle))
    await destructionRequestRepository.destroyMany(phoneNumbersToDestroy)

    return Promise.all([
      phoneNumbersToDestroy.length === 0
        ? Promise.resolve()
        : notifier.notifyMaintainers(
            `${phoneNumbersToDestroy.length} destruction requests processed:\n\n` +
              `${map(destructionResults, 'message').join('\n')}`,
          ),
    ])
  } catch (err) {
    return notifier.notifyMaintainers(`Error processing recycle job: ${err}`)
  }
}

// (Channel) -> Promise<void>
const redeem = async channel => {
  try {
    await destructionRequestRepository.destroy(channel.phoneNumber)
    await Promise.all([
      notifier.notifyAdmins(channel, notificationKeys.CHANNEL_REDEEMED),
      notifier.notifyMaintainers(
        `${channel.phoneNumber} had been scheduled for recycling, but was just redeemed.`,
      ),
    ])
  } catch (err) {
    return notifier.notifyMaintainers(`Error redeeming ${channel.phoneNumber}: ${err}`)
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
      message: `${phoneNumber} destroyed.`,
    }
  } catch (err) {
    return {
      status: 'ERROR',
      message: `${phoneNumber} failed to be destroyed. Error: ${err}`,
    }
  }
}

module.exports = { requestToDestroy, processDestructionRequests, recycle, redeem }
