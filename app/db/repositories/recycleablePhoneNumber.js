const app = require('../..')
const moment = require('moment')
const { repeatEvery, loggerOf } = require('../../util')
const logger = loggerOf('db|recycleablePhoneNumberRepository')
const {
  job: { recyclePhoneNumberInterval, recycleGracePeriod },
} = require('../../config')
const channelRepository = require('./channel')
const { recycle } = require('../../registrar/phoneNumber/recycle')

// (String) -> Promise
const enqueue = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.create({
    channelPhoneNumber,
    whenEnqueued: new Date().toISOString(),
  })

// (String) -> Promise
const dequeue = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.destroy({ where: { channelPhoneNumber } })

// (String) -> Promise
const findByPhoneNumber = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.findOne({ where: { channelPhoneNumber } })

// launches job to recycle recycleable numbers
const checkForRecycleablePhoneNumbers = () =>
  repeatEvery(() => recyclePhoneNumbers().catch(logger.error), recyclePhoneNumberInterval)

/**
 * RECYCLING HELPER FUNCTIONS
 */

const recyclePhoneNumbers = async () => {
  const recycleablePhoneNumbers = await app.db.recycleablePhoneNumber.findAll({})

  // dequeue recycleableNumbers that were used within recycleDelay window
  recycleablePhoneNumbers
    .filter(usedRecently)
    .forEach(async ({ channelPhoneNumber }) => await dequeue(channelPhoneNumber))

  // recycle channel if enqueued before recycleDelay window
  recycleablePhoneNumbers.filter(enqueuedAwhileAgo).forEach(async ({ channelPhoneNumber }) => {
    await dequeue(channelPhoneNumber)
    await recycle(channelPhoneNumber)
  })
}

// (Object) -> boolean
const enqueuedAwhileAgo = ({ createdAt }) => {
  // difference between now and grace period
  const recycleDelayWindow = moment().subtract(recycleGracePeriod)
  return moment(createdAt).diff(recycleDelayWindow) < 0
}

// (Object) -> boolean
const usedRecently = async ({ channelPhoneNumber }) => {
  const channel = await channelRepository.findDeep(channelPhoneNumber)

  const lastUsed = moment(channel.messageCount.updatedAt)
  const recycleDelayWindow = moment().subtract(recycleGracePeriod)
  return lastUsed.diff(recycleDelayWindow) > 0
}

module.exports = { enqueue, dequeue, findByPhoneNumber, checkForRecycleablePhoneNumbers }
