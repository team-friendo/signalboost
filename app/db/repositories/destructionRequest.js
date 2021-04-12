const { Op } = require('sequelize')
const app = require('../../../app')
const util = require('../../util')
const { memberTypes } = require('./membership')
const {
  jobs: { channelDestructionGracePeriod },
} = require('../../config')

const notificationInterval = channelDestructionGracePeriod / 3

// (string) -> Promise<{ destructionRequest: DestructionRequest, wasCreated: boolean }>
const findOrCreate = channelPhoneNumber =>
  app.db.destructionRequest
    .findOrCreate({ where: { channelPhoneNumber } })
    .then(([destructionRequest, wasCreated]) => ({
      destructionRequest,
      wasCreated,
    }))

// (Array<string>) -> Promise<void>
const destroy = channelPhoneNumber =>
  app.db.destructionRequest.destroy({ where: { channelPhoneNumber } })

// (Array<string>) -> Promise<void>
const destroyMany = channelPhoneNumbers =>
  app.db.destructionRequest.destroy({
    where: { channelPhoneNumber: { [Op.in]: channelPhoneNumbers } },
  })

// () => Promise<Array<DestructionRequest>>
const getNotifiableDestructionRequests = async () => {
  // Use this query to fetch channels that are scheduled for destruction,
  // whose requests are still pending, and have not been notified in more than 1/3 of the grace period
  // (To ensure that admins get 3 notifications before their channel is deleted).
  const gracePeriodStart = util
    .now()
    .clone()
    .subtract(channelDestructionGracePeriod, 'ms')
  const notificationThreshold = util
    .now()
    .clone()
    .subtract(notificationInterval, 'ms')
  return app.db.destructionRequest.findAll({
    where: {
      createdAt: { [Op.gt]: gracePeriodStart },
      lastNotifiedAt: { [Op.lte]: notificationThreshold },
    },
    // we include channels' admin memberships to allow notifying admins w/o extra db queries
    include: [
      {
        model: app.db.channel,
        include: [{ model: app.db.membership, where: { type: memberTypes.ADMIN } }],
      },
    ],
  })
}

// (string, Array<string>) -> Promise<number>
const recordNotifications = (timestamp, channelPhoneNumbers) =>
  app.db.destructionRequest.update(
    {
      lastNotifiedAt: timestamp,
    },
    { where: { channelPhoneNumber: { [Op.in]: channelPhoneNumbers } } },
  )

// () => Promise<Array<DestructionRequest>>
const getMatureDestructionRequests = async () => {
  // Admins have a 3 day grace period to redeem a channel slated for destruction by using it.
  // Here, we find all the requests issued before the start of the grace period, and return their
  // phone numbers to the caller for destruction. We may safely assume they can be destroyed, because
  // if redeemed (in dispatcher.dispatch), the destruction request would have been deleted.
  const gracePeriodStart = util
    .now()
    .clone()
    .subtract(channelDestructionGracePeriod, 'ms')
  return app.db.destructionRequest.findAll({
    where: { createdAt: { [Op.lte]: gracePeriodStart } },
    include: [
      {
        model: app.db.channel,
        include: [{ model: app.db.membership }, { model: app.db.messageCount }],
      },
    ],
  })
}

module.exports = {
  destroy,
  destroyMany,
  findOrCreate,
  getMatureDestructionRequests,
  getNotifiableDestructionRequests,
  recordNotifications,
}
