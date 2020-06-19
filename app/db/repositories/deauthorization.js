const app = require('../../../app')

const create = (channelPhoneNumber, memberPhoneNumber, fingerprint) =>
  app.db.deauthorization.create({ channelPhoneNumber, memberPhoneNumber, fingerprint })

const destroy = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.deauthorization.destroy({ where: { channelPhoneNumber, memberPhoneNumber } })

module.exports = { create, destroy }
