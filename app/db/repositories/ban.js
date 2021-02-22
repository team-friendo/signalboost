const app = require('../../../app')
const util = require('../../util')

const isBanned = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.ban
    .findOne({
      where: { channelPhoneNumber, memberPhoneNumber: util.sha256Hash(memberPhoneNumber) },
    })
    .then(Boolean)

const banMember = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.ban.create({ channelPhoneNumber, memberPhoneNumber: util.sha256Hash(memberPhoneNumber) })

module.exports = {
  isBanned,
  banMember,
}
