const app = require('../../../app')
const { defaultLanguage } = require('../../config')

const memberTypes = {
  ADMIN: 'ADMIN',
  SUBSCRIBER: 'SUBSCRIBER',
  NONE: 'NONE',
}

const findMembership = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.membership.findOne({ where: { channelPhoneNumber, memberPhoneNumber } }) ||
  Promise.reject('no membership found')

const addAdmins = (channelPhoneNumber, adminNumbers = []) =>
  performOpIfChannelExists(channelPhoneNumber, 'subscribe human to', () =>
    Promise.all(adminNumbers.map(num => addAdmin(channelPhoneNumber, num))),
  )

const addAdmin = async (channelPhoneNumber, memberPhoneNumber) => {
  // - when given the phone number of...
  //   - a new user: make an admin
  //   - an existing admin: return that admin's membership (do not error or alter/create anything)
  //   - an existing subscriber: update membership to admin status & return it (do not error or create anything)
  // - IMPORTANT CONTEXT:
  //   - `#addAdmin` MUST be idempotent to ensure the correct re-trusting of admin safety numbers
  //   - in particular, when someone uses the `ADD` command for a user who is already an admin,
  //     `#addAdmin must not throw a uniqueness constraint error. It must succeed  so that a welcome
  //     message is sent, which will fail to send (b/c of changed safety number) and trigger `trustAndResend`
  //     to be called which will ultimately result in the admin's saftey number being trusted (as desired)
  //   - because of the way signald handles changed safety numbers, we have NO OTHER WAY of detecting a
  //     changed safety number and retrusting it without first sending a message, so observing
  //     the above invariant is extra important
  const membership = (await app.db.membership.findOrCreate({
    where: { channelPhoneNumber, memberPhoneNumber },
    defaults: { type: memberTypes.ADMIN },
  }))[0]
  return membership.update({ type: memberTypes.ADMIN })
}

const addSubscriber = async (channelPhoneNumber, memberPhoneNumber, language = defaultLanguage) =>
  performOpIfChannelExists(channelPhoneNumber, 'subscribe member to', async () => {
    const [membership] = await app.db.membership.findOrCreate({
      where: {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber,
        memberPhoneNumber,
        language,
      },
    })
    return membership
  })

const removeMember = async (channelPhoneNumber, memberPhoneNumber) =>
  performOpIfChannelExists(channelPhoneNumber, 'unsubscribe member from', async () =>
    app.db.membership.destroy({ where: { channelPhoneNumber, memberPhoneNumber } }),
  )

const resolveMemberType = async (channelPhoneNumber, memberPhoneNumber) => {
  const member = await app.db.membership.findOne({
    where: { channelPhoneNumber, memberPhoneNumber },
  })
  return member ? member.type : memberTypes.NONE
}

const resolveSenderLanguage = async (channelPhoneNumber, memberPhoneNumber, senderType) => {
  if (senderType === memberTypes.NONE) return defaultLanguage
  const member = await app.db.membership.findOne({
    where: { channelPhoneNumber, memberPhoneNumber },
  })
  return member ? member.language : defaultLanguage
}

// (Database, string, string) -> Array<number>
const updateLanguage = async (memberPhoneNumber, language) =>
  app.db.membership.update({ language }, { where: { memberPhoneNumber } })

const isMember = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.membership.findOne({ where: { channelPhoneNumber, memberPhoneNumber } }).then(Boolean)

const isAdmin = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.membership
    .findOne({ where: { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber } })
    .then(Boolean)

const isSubscriber = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.membership
    .findOne({ where: { type: memberTypes.SUBSCRIBER, channelPhoneNumber, memberPhoneNumber } })
    .then(Boolean)

// HELPERS

const performOpIfChannelExists = async (channelPhoneNumber, opDescription, op) => {
  const ch = await app.db.channel.findOne({
    where: { phoneNumber: channelPhoneNumber },
    include: [{ model: app.db.membership }],
  })
  return ch ? op(ch) : Promise.reject(`cannot ${opDescription} non-existent channel`)
}

module.exports = {
  addAdmin,
  addAdmins,
  addSubscriber,
  findMembership,
  isMember,
  isAdmin,
  isSubscriber,
  removeMember,
  resolveMemberType,
  resolveSenderLanguage,
  updateLanguage,
  memberTypes,
}
