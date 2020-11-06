const app = require('../../../app')

const isBanned = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.ban.findOne({ where: { channelPhoneNumber, memberPhoneNumber } }).then(Boolean)

const banMember = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.ban.create({ channelPhoneNumber, memberPhoneNumber })

module.exports = {
  isBanned,
  banMember,
}
