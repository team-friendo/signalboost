const { times } = require('lodash')
const { defaultLanguage } = require('../../config')

const memberTypes = {
  ADMIN: 'ADMIN',
  SUBSCRIBER: 'SUBSCRIBER',
  NONE: 'NONE',
}

const addAdmins = (db, channelPhoneNumber, adminNumbers = []) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    Promise.all(adminNumbers.map(num => addAdmin(db, channelPhoneNumber, num))),
  )

const addAdmin = (db, channelPhoneNumber, memberPhoneNumber) =>
  // NOTE(aguestuser|2019-09-26):
  //  - it is EXTREMELY IMPORTANT that `#addAdmin` remain idempotent
  //  - due to signald peculiarities, lots of logic about detecting safety number changes for admins
  //    and correctly (re)trusting their key material hangs off of this invariant. do not violate it! thx! :)
  // TODO:
  //  - make this upgrade a subscriber to an admin using `defaults` key
  //  - leave a better explanation of how idempotency works
  db.membership
    .findOrCreate({ where: { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber } })
    .spread(x => x)

const removeAdmin = (db, channelPhoneNumber, memberPhoneNumber) =>
  // TODO: use performOpIfChannelExists here
  db.membership.destroy({ where: { channelPhoneNumber, memberPhoneNumber } })

const addSubscriber = async (
  db,
  channelPhoneNumber,
  memberPhoneNumber,
  language = defaultLanguage,
) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe member to', () =>
    db.membership.create({
      type: memberTypes.SUBSCRIBER,
      channelPhoneNumber,
      memberPhoneNumber,
      language,
    }),
  )

const removeSubscriber = async (db, channelPhoneNumber, memberPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'unsubscribe member from', async () =>
    db.membership.destroy({ where: { channelPhoneNumber, memberPhoneNumber } }),
  )

const resolveSenderType = async (db, channelPhoneNumber, memberPhoneNumber) => {
  const member = await db.membership.findOne({ where: { channelPhoneNumber, memberPhoneNumber } })
  return member ? member.type : memberTypes.NONE
}

const resolveSenderLanguage = async (db, channelPhoneNumber, memberPhoneNumber, senderType) => {
  if (senderType === memberTypes.NONE) return defaultLanguage
  const member = await db.membership.findOne({ where: { channelPhoneNumber, memberPhoneNumber } })
  return member ? member.language : defaultLanguage
}

// (Database, string, string) -> Array<number>
const updateLanguage = async (db, memberPhoneNumber, language) =>
  db.membership.update({ language }, { where: { memberPhoneNumber } })

const isAdmin = (db, channelPhoneNumber, memberPhoneNumber) =>
  db.membership
    .findOne({ where: { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber } })
    .then(Boolean)

const isSubscriber = (db, channelPhoneNumber, memberPhoneNumber) =>
  db.membership
    .findOne({ where: { type: memberTypes.SUBSCRIBER, channelPhoneNumber, memberPhoneNumber } })
    .then(Boolean)

// HELPERS

const performOpIfChannelExists = async (db, channelPhoneNumber, opDescription, op) => {
  const ch = await db.channel.findOne({
    where: { phoneNumber: channelPhoneNumber },
    include: [{ model: db.membership }],
  })
  return ch ? op(ch) : Promise.reject(`cannot ${opDescription} non-existent channel`)
}

module.exports = {
  addAdmin,
  addAdmins,
  addSubscriber,
  isAdmin,
  isSubscriber,
  removeAdmin,
  removeSubscriber,
  resolveSenderType,
  resolveSenderLanguage,
  updateLanguage,
  memberTypes,
}
