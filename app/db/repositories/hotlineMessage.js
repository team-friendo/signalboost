const moment = require('moment')
const app = require('../../../app')
const { Op } = require('sequelize')
const {
  job: { hotlineMessageExpiryInMillis },
} = require('../../config')

// ({Database, string, string}) => Promise<string>
const getMessageId = async ({ channelPhoneNumber, memberPhoneNumber }) => {
  const [hm] = await app.db.hotlineMessage.findOrCreate({
    where: { channelPhoneNumber, memberPhoneNumber },
  })
  return hm.id
}

// ({Database, string, number}) => Promise<string>
const findMemberPhoneNumber = async id => {
  const hm = await app.db.hotlineMessage.findOne({ where: { id } })
  return hm
    ? Promise.resolve(hm.memberPhoneNumber)
    : Promise.reject(new Error('hotline message does not exist'))
}

// (Database) => Promise<number>
const deleteExpired = () =>
  app.db.hotlineMessage.destroy({
    where: {
      createdAt: {
        [Op.lte]: moment().subtract(hotlineMessageExpiryInMillis, 'ms'),
      },
    },
  })

module.exports = { getMessageId, findMemberPhoneNumber, deleteExpired }
