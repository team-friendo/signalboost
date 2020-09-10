import { Op } from 'sequelize'

const app = require('../../../app')
const { loggerOf } = require('../../util')
const { memberTypes } = require('./membership')
const {
  signal: { supportPhoneNumber },
} = require('../../config')

const logger = loggerOf('db.repositories.channel')

/***********
 * QUERIES
 ***********/

const create = async (phoneNumber, name, adminPhoneNumbers) => {
  const memberships = adminPhoneNumbers.map(pNum => ({
    type: memberTypes.ADMIN,
    memberPhoneNumber: pNum,
  }))
  const channel = await findByPhoneNumber(phoneNumber)
  const include = [{ model: app.db.messageCount }, { model: app.db.membership }]
  return !channel
    ? app.db.channel.create({ phoneNumber, name, memberships, messageCount: {} }, { include })
    : channel
        .update({ name, memberships, returning: true }, { include })
        .then(c => ({ ...c.dataValues, memberships, messageCount: channel.messageCount }))
}

const update = (phoneNumber, attrs) =>
  app.db.channel
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([, [pNumInstance]]) => pNumInstance)

// (string, Transaction | null) => Promise<boolean>
const destroy = async (phoneNumber, transaction) => {
  const numDestroyed = await app.db.channel.destroy({
    where: { phoneNumber },
    ...(transaction ? { transaction } : {}),
  })
  return numDestroyed > 0
}

const findAll = () => app.db.channel.findAll()

const findAllDeep = () =>
  app.db.channel.findAll({
    include: [
      { model: app.db.deauthorization },
      { model: app.db.invite },
      { model: app.db.membership },
      { model: app.db.messageCount },
    ],
  })

const findManyDeep = phoneNumbers =>
  app.db.channel.findAll({
    where: { phoneNumber: { [Op.in]: phoneNumbers } },
    include: [
      { model: app.db.deauthorization },
      { model: app.db.invite },
      { model: app.db.membership },
      { model: app.db.messageCount },
    ],
  })

const findByPhoneNumber = phoneNumber => app.db.channel.findOne({ where: { phoneNumber } })

const findDeep = phoneNumber =>
  app.db.channel.findOne({
    where: { phoneNumber },
    include: [
      { model: app.db.deauthorization },
      { model: app.db.invite },
      { model: app.db.membership },
      { model: app.db.messageCount },
    ],
  })

const isSysadmin = async phoneNumber => {
  if (!supportPhoneNumber) return false
  try {
    const sysadminPhoneNumbers = getAdminPhoneNumbers(await findDeep(supportPhoneNumber))
    return sysadminPhoneNumbers.includes(phoneNumber)
  } catch (e) {
    logger.error(e)
    return false
  }
}

/************
 * SELECTORS
 ***********/

// all selectors assume you are operating on an already deeply-fetched channel (with all nested attrs avail)
const getMemberPhoneNumbers = channel => (channel.memberships || []).map(m => m.memberPhoneNumber)
const getMemberPhoneNumbersExcept = (channel, phoneNumbers) =>
  getMemberPhoneNumbers(channel).filter(pn => !phoneNumbers.includes(pn))

const getAdminMemberships = channel => channel.memberships.filter(m => m.type === memberTypes.ADMIN)
const getAdminPhoneNumbers = channel => getAdminMemberships(channel).map(m => m.memberPhoneNumber)

// (Channel, Array<string>) -> Array<Membership>
const getAllAdminsExcept = (channel, phoneNumbers) =>
  getAdminMemberships(channel).filter(m => !phoneNumbers.includes(m.memberPhoneNumber))

const getSubscriberMemberships = channel =>
  channel.memberships.filter(m => m.type === memberTypes.SUBSCRIBER)
const getSubscriberPhoneNumbers = channel =>
  getSubscriberMemberships(channel).map(m => m.memberPhoneNumber)

module.exports = {
  create,
  destroy,
  findAll,
  findAllDeep,
  findByPhoneNumber,
  findDeep,
  findManyDeep,
  getAllAdminsExcept,
  getAdminMemberships,
  getAdminPhoneNumbers,
  getMemberPhoneNumbers,
  getMemberPhoneNumbersExcept,
  getSubscriberMemberships,
  getSubscriberPhoneNumbers,
  isSysadmin,
  update,
}
