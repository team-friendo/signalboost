const app = require('../../../app')
const moment = require('moment')
const { Op } = require('sequelize')
const {
  twilio: { smsQuotaAmount, smsQuotaDurationInMillis },
} = require('../../config')

// (Database, String) -> Promise<SmsSender>
const countMessage = async phoneNumber => {
  const [smsSender] = await app.db.smsSender.findOrCreate({ where: { phoneNumber } })
  return smsSender.increment({ messagesSent: 1 })
}

// (Database, String) -> Promise<boolean>
const hasReachedQuota = async phoneNumber => {
  const [smsSender] = await app.db.smsSender.findOrCreate({ where: { phoneNumber } })
  return smsSender.messagesSent >= smsQuotaAmount
}

// DataBase -> Promise<number>
const deleteExpired = async () =>
  app.db.smsSender.destroy({
    where: {
      createdAt: {
        [Op.lte]: moment().subtract(smsQuotaDurationInMillis, 'ms'),
      },
    },
  })

module.exports = { countMessage, hasReachedQuota, deleteExpired }
