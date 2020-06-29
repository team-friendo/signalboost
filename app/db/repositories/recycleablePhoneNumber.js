const app = require('../..')

const enqueue = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.create({
    channelPhoneNumber,
    whenEnqueued: new Date().toISOString(),
  })

const dequeue = channelPhoneNumber =>
  app.db.recycleablePhoneNumber.destroy({ where: { channelPhoneNumber } })

module.exports = { enqueue, dequeue }
