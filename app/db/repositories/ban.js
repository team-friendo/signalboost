const app = require('../../../app')
const util = require('../../util')
const { first } = require('lodash')

// (string, string) -> Promise<Boolean>
const isBanned = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.ban
    .findOne({
      where: { channelPhoneNumber, memberPhoneNumber: util.sha256Hash(memberPhoneNumber) },
    })
    .then(Boolean)

// (string, Array<string>) -> Array<string>
const findBanned = async (channelPhoneNumber, memberPhoneNumbers) =>
  (
    await Promise.all(
      memberPhoneNumbers.map(async memberPhoneNumber => [
        memberPhoneNumber,
        await isBanned(channelPhoneNumber, memberPhoneNumber),
      ]),
    )
  )
    .filter(([, isBanned]) => isBanned)
    .map(first)

// (string, string) -> Promise<Ban>
const banMember = async (channelPhoneNumber, memberPhoneNumber) => {
  const tx = await app.db.sequelize.transaction()
  try {
    const ban = await app.db.ban.create({
      channelPhoneNumber,
      memberPhoneNumber: util.sha256Hash(memberPhoneNumber),
    })
    await app.db.membership.destroy({ where: { channelPhoneNumber, memberPhoneNumber } })
    await tx.commit()
    return ban
  } catch (e) {
    await tx.rollback()
    throw e
  }
}

module.exports = {
  isBanned,
  findBanned,
  banMember,
}
