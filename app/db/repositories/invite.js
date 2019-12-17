const membershipRepository = require('./membership')
const { defaultLanguage } = require('../../config')

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

module.exports = { issue, count, accept, decline }
