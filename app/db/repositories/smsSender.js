const {
  twilio: { monthlySmsQuota },
} = require('../../config')

// (Database, String) -> Promise<SmsSender>
const countMessage = async (db, phoneNumber) => {
  const [smsSender] = await db.smsSender.findOrCreate({ where: { phoneNumber } })
  return smsSender.increment({ messagesSent: 1 })
}

// (Database, String) -> Promise<boolean>
const hasReachedQuota = async (db, phoneNumber) => {
  const [smsSender] = await db.smsSender.findOrCreate({ where: { phoneNumber } })
  return smsSender.messagesSent >= monthlySmsQuota
}

module.exports = { countMessage, hasReachedQuota }
