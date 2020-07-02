const app = require('../..')

const enqueue = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.create({
    channelPhoneNumber,
    whenEnqueued: new Date().toISOString(),
  })

const dequeue = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.destroy({ where: { channelPhoneNumber } })

const findByPhoneNumber = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.findOne({ where: { channelPhoneNumber } })

module.exports = { enqueue, dequeue, findByPhoneNumber }
