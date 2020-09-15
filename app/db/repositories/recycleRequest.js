const { Op } = require('sequelize')
const app = require('../../../app')
const util = require('../../util')
const { map } = require('lodash')
const {
  job: { recycleGracePeriod },
} = require('../../config')

// (string) -> Promise<{ recycleRequest: RecycleRequest, wasCreated: boolean }>
const requestToRecycle = channelPhoneNumber =>
  app.db.recycleRequest
    .findOrCreate({ where: { channelPhoneNumber } })
    .then(([recycleRequest, wasCreated]) => ({
      recycleRequest,
      wasCreated,
    }))

// (Array<string>) -> Promise<void>
const destroy = channelPhoneNumber =>
  app.db.recycleRequest.destroy({ where: { channelPhoneNumber } })

// (Array<string>) -> Promise<void>
const destroyMany = channelPhoneNumbers =>
  app.db.recycleRequest.destroy({ where: { channelPhoneNumber: { [Op.in]: channelPhoneNumbers } } })

// () => Promise<string>
const getMatureRecycleRequests = async () => {
  // Admins have a 24hr grace period to redeem a channel slated for recycling by using it.
  // Here, we find all the requests issued before the start of the grace period, and return their
  // phone numbers to the caller for recycling. We may safely assume they can be recycled, becuase
  // if redeemed (in dispatcher.dispatch)
  const gracePeriodStart = util.now().subtract(parseInt(recycleGracePeriod), 'ms')
  const matureRequests = await app.db.recycleRequest.findAll({
    where: { createdAt: { [Op.lte]: gracePeriodStart } },
  })
  return map(matureRequests, 'channelPhoneNumber')
}

module.exports = { requestToRecycle, getMatureRecycleRequests, destroy, destroyMany }
