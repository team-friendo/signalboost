const membershipRepository = require('./membership')
const { loggerOf } = require('../../services/util')
const logger = loggerOf('db|inviteRepository')

// (Database, string, string, string) -> boolean
const issue = async (db, channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber) => {
  // issues invite IFF invitee is not already member of channel or invited by same person
  // returns true if invite issued, false otherwise
  try {
    if (await membershipRepository.isMember(db, channelPhoneNumber, inviteePhoneNumber))
      return false
    const [, wasInviteCreated] = await db.invite.findOrCreate({
      where: { channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber },
    })
    return wasInviteCreated
  } catch (e) {
    logger.error(e)
    return false
  }
}

module.exports = { issue }
