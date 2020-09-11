const { Op } = require('sequelize')
const app = require('../../../app')
const util = require('../../util')
const { map, partition } = require('lodash')
const {
  job: { recycleGracePeriod },
} = require('../../config')

// (string) -> Promise<{ recycleRequest: RecycleRequest, wasCreated: boolean }>
const requestToRecycle = phoneNumber =>
  app.db.recycleRequest
    .findOrCreate({ where: { phoneNumber } })
    .then(([recycleRequest, wasCreated]) => ({
      recycleRequest,
      wasCreated,
    }))

// (Array<string>) -> Promise<void>
const destroyMany = phoneNumbers =>
  app.db.recycleRequest.destroy({
    where: { phoneNumber: { [Op.in]: phoneNumbers } },
  })

const evaluateRecycleRequests = async () => {
  // channel admins have a 1 day grace period to redeem a channel slated for recycling
  // by using it. calculate when that grace period started...
  const gracePeriodStart = util.now().subtract(parseInt(recycleGracePeriod), 'ms')

  // find all the requests issued before the start of the grace period, indicating
  // channels which should be considered for recycling (b/c their grace period has passed)
  const matureRequests = await app.db.recycleRequest.findAll({
    where: { createdAt: { [Op.lte]: gracePeriodStart } },
  })

  // make lists of redeemed and unredeemed channel phone numbers, where "redeemed" channels
  // have been used since the start of the grace period, and thus should not be recycled
  const [redeemed, toRecycle] = partition(
    await app.db.messageCount.findAll({
      where: { channelPhoneNumber: { [Op.in]: map(matureRequests, 'phoneNumber') } },
    }),
    messageCount => messageCount.updatedAt > gracePeriodStart,
  )

  // pluck the channel phone numbers and return them for processing!
  return {
    redeemed: map(redeemed, 'channelPhoneNumber'),
    toRecycle: map(toRecycle, 'channelPhoneNumber'),
  }
}

module.exports = { requestToRecycle, evaluateRecycleRequests, destroyMany }
