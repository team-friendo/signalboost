const app = require('../../../app')
const moment = require('moment')
const { Op } = require('sequelize')
const membershipRepository = require('./membership')
const { repeatEvery, loggerOf } = require('../../util')
const logger = loggerOf('db|inviteRepository')
const {
  defaultLanguage,
  job: { inviteExpiryInMillis, inviteDeletionInterval },
} = require('../../config')

// (Database, string, string, string) -> Promise<boolean>
const issue = async (channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber) => {
  // issues invite IFF invitee is not already invited
  const [, wasCreated] = await app.db.invite.findOrCreate({
    where: { channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber },
  })
  return wasCreated
}

// (Database, string, string) -> Promise<number>
const count = (channelPhoneNumber, inviteePhoneNumber) =>
  app.db.invite.count({ where: { channelPhoneNumber, inviteePhoneNumber } })

// (Database, string, string, string) -> Promise<Array<Membership,number>>
const accept = (channelPhoneNumber, inviteePhoneNumber, language = defaultLanguage) =>
  Promise.all([
    membershipRepository.addSubscriber(channelPhoneNumber, inviteePhoneNumber, language),
    app.db.invite.destroy({ where: { channelPhoneNumber, inviteePhoneNumber } }),
  ])

// (Database, string, string) -> Promise<number>
const decline = async (channelPhoneNumber, inviteePhoneNumber) =>
  app.db.invite.destroy({ where: { channelPhoneNumber, inviteePhoneNumber } })

// (Database, number) -> Promise<void>
const launchInviteDeletionJob = () =>
  repeatEvery(() => deleteExpired().catch(logger.error), inviteDeletionInterval)

// Database -> Promise<number>
const deleteExpired = async () =>
  app.db.invite.destroy({
    where: {
      createdAt: {
        [Op.lte]: moment().subtract(inviteExpiryInMillis, 'ms'),
      },
    },
  })

module.exports = { issue, count, accept, decline, deleteExpired, launchInviteDeletionJob }
