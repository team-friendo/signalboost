const moment = require('moment')
const { Op } = require('sequelize')
const membershipRepository = require('./membership')
const { repeatEvery, loggerOf } = require('../../services/util')
const logger = loggerOf('db|inviteRepository')
const {
  defaultLanguage,
  job: { inviteExpiryInMillis, inviteDeletionInterval },
} = require('../../config')

// (Database, string, string, string) -> Promise<boolean>
const issue = async (db, channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber) => {
  // issues invite IFF invitee is not already invited
  const [, wasCreated] = await db.invite.findOrCreate({
    where: { channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber },
  })
  return wasCreated
}

// (Database, string, string) -> Promise<number>
const count = (db, channelPhoneNumber, inviteePhoneNumber) =>
  db.invite.count({ where: { channelPhoneNumber, inviteePhoneNumber } })

// (Database, string, string, string) -> Promise<Array<Membership,number>>
const accept = (db, channelPhoneNumber, inviteePhoneNumber, language = defaultLanguage) =>
  Promise.all([
    membershipRepository.addSubscriber(db, channelPhoneNumber, inviteePhoneNumber, language),
    db.invite.destroy({ where: { channelPhoneNumber, inviteePhoneNumber } }),
  ])

// (Database, string, string) -> Promise<number>
const decline = async (db, channelPhoneNumber, inviteePhoneNumber) =>
  db.invite.destroy({ where: { channelPhoneNumber, inviteePhoneNumber } })

// (Database, number) -> Promise<void>
const launchInviteDeletionJob = db =>
  repeatEvery(() => deleteExpired(db).catch(logger.error), inviteDeletionInterval)

// Database -> Promise<number>
const deleteExpired = async db =>
  db.invite.destroy({
    where: {
      createdAt: {
        [Op.lte]: moment().subtract(inviteExpiryInMillis, 'ms'),
      },
    },
  })

module.exports = { issue, count, accept, decline, deleteExpired, launchInviteDeletionJob }
