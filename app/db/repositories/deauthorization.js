const create = (db, channelPhoneNumber, memberPhoneNumber, fingerprint) =>
  db.deauthorization.create({ channelPhoneNumber, memberPhoneNumber, fingerprint })

const destroy = (db, channelPhoneNumber, memberPhoneNumber) =>
  db.deauthorization.destroy({ where: { channelPhoneNumber, memberPhoneNumber } })

module.exports = { create, destroy }
