const { Op } = require('sequelize')
const app = require('../../../app')
const util = require('../../util')
const { map } = require('lodash')
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

// () => Promise<Array<Channel>
const getNotifiableDestructionTargets = async () => {
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
  })
}

// () => Promise<Array<string>>
const getMatureDestructionTargets = async () => {
  // Admins have a 3 day grace period to redeem a channel slated for destruction by using it.
  // Here, we find all the requests issued before the start of the grace period, and return their
  // phone numbers to the caller for destruction. We may safely assume they can be destroyed, because
  // if redeemed (in dispatcher.dispatch), the destruction request would have been deleted.
  const gracePeriodStart = util
    .now()
    .clone()
    .subtract(channelDestructionGracePeriod, 'ms')
  const matureRequests = await app.db.destructionRequest.findAll({
    where: { createdAt: { [Op.lte]: gracePeriodStart } },
  })
  return map(matureRequests, 'channelPhoneNumber')
}

module.exports = {
  findOrCreate,
  getNotifiableDestructionTargets,
  getMatureDestructionTargets,
  destroy,
  destroyMany,
}
