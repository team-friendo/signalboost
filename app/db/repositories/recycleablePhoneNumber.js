const app = require('../..')
const moment = require('moment')
const { repeatEvery, loggerOf } = require('../../util')
const logger = loggerOf('db|recycleablePhoneNumberRepository')
const recycleService = require('../../registrar/phoneNumber/recycle')
const {
  job: { recyclePhoneNumberDelay },
} = require('../../config')

const enqueue = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.create({
    channelPhoneNumber,
    whenEnqueued: new Date().toISOString(),
  })

const dequeue = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.destroy({ where: { channelPhoneNumber } })

const findByPhoneNumber = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.findOne({ where: { channelPhoneNumber } })

const checkForRecycleablePhoneNumbers = () =>
  repeatEvery(() => recyclePhoneNumbers().catch(logger.error), recyclePhoneNumberDelay)

const recyclePhoneNumbers = async () => {
  // console.log(recycle)
  const recycleablePhoneNumbers = await app.db.recycleablePhoneNumber.findAll({})
  recycleablePhoneNumbers.forEach(recycleablePhoneNumber => {
    recycleService.recycle(recycleablePhoneNumber.channelPhoneNumber)
  })
}
module.exports = { enqueue, dequeue, findByPhoneNumber, checkForRecycleablePhoneNumbers }
