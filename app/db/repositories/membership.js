const app = require('../../../app')
const { defaultLanguage } = require('../../config')
const { loggerOf } = require('../../util')
const logger = loggerOf('db.repositories.membership')

const memberTypes = {
  ADMIN: 'ADMIN',
  SUBSCRIBER: 'SUBSCRIBER',
  NONE: 'NONE',
}

const findMembership = (channelPhoneNumber, memberPhoneNumber) =>
  app.db.membership.findOne({ where: { channelPhoneNumber, memberPhoneNumber } }) ||
  Promise.reject('no membership found')

const addAdmin = async (channelPhoneNumber, memberPhoneNumber) =>
  (await addAdmins(channelPhoneNumber, [memberPhoneNumber]))[0]

// (string, Array<string>) -> Promise<Array<Membership>>
const addAdmins = (channelPhoneNumber, adminNumbers = []) =>
  performOpIfChannelExists(channelPhoneNumber, 'subscribe human to', async channel => {
    const tx = await app.db.sequelize.transaction()
    try {
      const newAdmins = await Promise.all(
        adminNumbers.map((num, idx) => _findOrCreateAdminMembership(channel, num, idx, tx)),
      )
      await channel.update({ nextAdminId: channel.nextAdminId + newAdmins.length })
      await tx.commit()
      return newAdmins
    } catch (err) {
      await tx.rollback()
      logger.error(err)
    }
  })

const _findOrCreateAdminMembership = async (channel, memberPhoneNumber, idx, transaction) => {
  // here, we use findOrCreate admin membership("idempotently create" it) because we might be:
  // (1) re - adding an admin who has been deauthorized or...
  const [membership] = await app.db.membership.findOrCreate({
    where: { channelPhoneNumber: channel.phoneNumber, memberPhoneNumber },
    defaults: { type: memberTypes.ADMIN, adminId: channel.nextAdminId + idx },
    transaction,
  })
  // ... (2) promoting an existing subscriber to an admin
  return membership.type === memberTypes.SUBSCRIBER
    ? membership.update(
        { type: memberTypes.ADMIN, adminId: channel.nextAdminId + idx },
        { transaction },
      )
    : membership
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

// (string, string, any -> Promise<any>) -> Promise<any>
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
  updateLanguage,
  memberTypes,
}
