const { Op } = require('sequelize')
const app = require('../../../app')
const util = require('../../util')
const { map } = require('lodash')
const {
  jobs: { channelDestructionGracePeriod },
} = require('../../config')

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

// () => Promise<string>
const getMatureDestructionRequests = async () => {
  // Admins have a 24hr grace period to redeem a channel slated for destruction by using it.
  // Here, we find all the requests issued before the start of the grace period, and return their
  // phone numbers to the caller for destruction. We may safely assume they can be destroyed, becuase
  // if redeemed (in dispatcher.dispatch)
  const gracePeriodStart = util.now().subtract(parseInt(channelDestructionGracePeriod), 'ms')
  const matureRequests = await app.db.destructionRequest.findAll({
    where: { createdAt: { [Op.lte]: gracePeriodStart } },
  })
  return map(matureRequests, 'channelPhoneNumber')
}

module.exports = { findOrCreate, getMatureDestructionRequests, destroy, destroyMany }
