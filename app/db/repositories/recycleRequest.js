const { Op } = require('sequelize')
const moment = require('moment')
const app = require('../../../app')
const phoneNumberRegistrar = require('../../registrar/phoneNumber')
const { loggerOf } = require('../../util')
const { repeatEvery } = require('../../util')
const { mapInvoke } = require('lodash')
const {
  job: { recycleInterval, recycleGracePeriod },
} = require('../../config')

const logger = loggerOf('repository.recycleRequest')

// (string) -> Promise<{ recycleRequest: RecycleRequest, wasCreated: boolean }>
const requestToRecycle = phoneNumber =>
  app.db.recycleRequest
    .findOrCreate({ where: { phoneNumber } })
    .then(([recycleRequest, wasCreated]) => ({
      recycleRequest,
      wasCreated,
    }))

const processRecycleRequests = async () => {
  // admins have a "grace period" of 1 day to use channels before they are recycled
  const gracePeriodStart = moment().subtract(recycleGracePeriod, 'ms')

  // find all the recycle requests issued over a day ago
  const matureRequests = await app.db.recycleRequest.find({
    where: {
      createdAt: { [Op.lte]: gracePeriodStart },
    },
  })

  // find all the channel phone numbers that haven't been used in the last day
  const unredeemedChannelPhoneNumbers = mapInvoke(
    await app.db.messageCount.find({
      where: {
        channelPhoneNumber: { [Op.in]: mapInvoke(matureRequests, 'phoneNumber') },
        updatedAt: { [Op.lte]: gracePeriodStart },
      },
    }),
    'channelPhoneNumber',
  )

  // recycle all the phone numbers that haven't been used during the 1-day grace period
  await Promise.all(unredeemedChannelPhoneNumbers.map(phoneNumberRegistrar.recycle))

  // destroy all mature requests (whose numbers have now either been recycled or redeemed)
  return app.db.recycleRequest.destroy({
    where: { phoneNumber: { [Op.in]: mapInvoke(matureRequests, 'phoneNumber') } },
  })
}

const launchRecycleJob = () =>
  repeatEvery(() => processRecycleRequests.catch(logger.error), recycleInterval)

module.exports = { requestToRecycle, processRecycleRequests, launchRecycleJob }
