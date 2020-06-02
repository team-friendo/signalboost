const moment = require('moment')
const { Op } = require('sequelize')
const {
  job: { hotlineMessageExpiryInMillis },
} = require('../../config')

// ({Database, string, string}) => Promise<string>
const getMessageId = async ({ db, channelPhoneNumber, memberPhoneNumber }) => {
  const [hm] = await db.hotlineMessage.findOrCreate({
    where: { channelPhoneNumber, memberPhoneNumber },
  })
  return hm.id
}

// ({Database, string, number}) => Promise<string>
const findMemberPhoneNumber = async ({ db, id }) => {
  const hm = await db.hotlineMessage.findOne({ where: { id } })
  return hm
    ? Promise.resolve(hm.memberPhoneNumber)
    : Promise.reject(new Error('hotline message does not exist'))
}

// (Database) => Promise<number>
const deleteExpired = db =>
  db.hotlineMessage.destroy({
    where: {
      createdAt: {
        [Op.lte]: moment().subtract(hotlineMessageExpiryInMillis, 'ms'),
      },
    },
  })

module.exports = { getMessageId, findMemberPhoneNumber, deleteExpired }
