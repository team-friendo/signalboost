const app = require('../../../app')
const util = require('../../util')
const { Op } = require('sequelize')
const { loggerOf } = require('../../util')
const { memberTypes } = require('./membership')
const { map } = require('lodash')
const {
  jobs: { channelExpiryInMillis },
  signal: { diagnosticsPhoneNumber, supportPhoneNumber },
} = require('../../config')

const logger = loggerOf('db.repositories.channel')

/***********
 * QUERIES
 ***********/

const create = async (phoneNumber, name, adminPhoneNumbers) => {
  const memberships = adminPhoneNumbers.map((pNum, idx) => ({
    type: memberTypes.ADMIN,
    memberPhoneNumber: pNum,
    adminId: idx + 1,
  }))

  const nextAdminId = memberships.length + 1
  const channel = await findByPhoneNumber(phoneNumber)
  const include = [{ model: app.db.messageCount }, { model: app.db.membership }]

  return !channel
    ? app.db.channel.create(
        { phoneNumber, name, memberships, messageCount: {}, nextAdminId },
        { include },
      )
    : channel
        .update({ name, memberships, returning: true, nextAdminId }, { include })
        .then(c => ({ ...c.dataValues, memberships, messageCount: channel.messageCount }))
}

const update = (phoneNumber, attrs) =>
  app.db.channel
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([, [pNumInstance]]) => pNumInstance)

// (string, Transaction | null) => Promise<boolean>
const destroy = async (phoneNumber, transaction = null) => {
  const channel = await findByPhoneNumber(phoneNumber)
  return channel ? channel.destroy({ transaction }).then(() => true) : false
}

const findAll = () => app.db.channel.findAll()

const findAllDeep = () =>
  app.db.channel.findAll({
    include: [
      { model: app.db.deauthorization },
      { model: app.db.invite },
      { model: app.db.membership },
      { model: app.db.messageCount },
      { model: app.db.destructionRequest },
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
      { model: app.db.destructionRequest },
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
      { model: app.db.destructionRequest },
    ],
  })

// string => Promise<boolean>
const isMaintainer = async phoneNumber => {
  if (!diagnosticsPhoneNumber) return false
  try {
    const maintainerPhoneNumbers = getAdminPhoneNumbers(await getDiagnosticsChannel())
    return maintainerPhoneNumbers.includes(phoneNumber)
  } catch (e) {
    logger.error(e)
    return false
  }
}

// () => Promsie<Array<string, number>>
const getChannelsSortedBySize = async () =>
  app.db.sequelize
    .query(
      `
      with non_empty as (
       select "channelPhoneNumber", count ("channelPhoneNumber") as kount from memberships
         group by "channelPhoneNumber"
      ),
      empty as (
        select "phoneNumber" as "channelPhoneNumber", 0 as kount from channels
          where "phoneNumber" not in (select distinct "channelPhoneNumber" from memberships)
      )
      select * from non_empty union select * from empty
      order by kount desc;
      `,
      {
        type: app.db.sequelize.QueryTypes.SELECT,
      },
    )
    .map(({ channelPhoneNumber, kount }) => [channelPhoneNumber, parseInt(kount)])

// () => Promise<Array<Channel>>
const getStaleChannels = async () =>
  // returns all channels not used during channel time-to-live window (4 weeks)
  // we exempt DIAGNOSTICS and SUPPORT b/c we never want to delete them!
  app.db.channel.findAll({
    where: {
      phoneNumber: { [Op.notIn]: [diagnosticsPhoneNumber, supportPhoneNumber] },
    },
    include: [
      {
        model: app.db.messageCount,
        where: {
          updatedAt: {
            [Op.lte]: util.now().subtract(parseInt(channelExpiryInMillis), 'ms'),
          },
        },
      },
    ],
  })

// (string, number) => Promise<number>
const updateSocketIds = async (channelPhoneNumbers, socketId) =>
  app.db.channel.update({ socketId }, { where: { phoneNumber: { [Op.in]: channelPhoneNumbers } } })

const getSocketId = async channelPhoneNumber => {
  const channel = await findByPhoneNumber(channelPhoneNumber)
  return channel && channel.socketId
}

const getChannelsOnSocket = socketId => app.db.channel.findAll({ where: { socketId } })

// () => Promise<Channel>
const getDiagnosticsChannel = async () => {
  if (!diagnosticsPhoneNumber) return null
  return findDeep(diagnosticsPhoneNumber)
}

// () => Promise<Array<Membership>>
const getMaintainers = async () => {
  if (!diagnosticsPhoneNumber) return []
  return getAdminMemberships(await getDiagnosticsChannel())
}

/************
 * SELECTORS
 ***********/

// all selectors assume you are operating on an already deeply-fetched channel (with all nested attrs avail)
const getMemberPhoneNumbers = channel => (channel.memberships || []).map(m => m.memberPhoneNumber)
const getMembersExcept = (channel, members) => {
  const phoneNumbersToExclude = new Set(map(members, 'memberPhoneNumber'))
  return channel.memberships.filter(m => !phoneNumbersToExclude.has(m.memberPhoneNumber))
}
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

// (ChannelInstance, number) => boolean
const canAddSubscribers = (channel, numSubscribers = 1) =>
  getSubscriberMemberships(channel).length + numSubscribers <= channel.subscriberLimit

module.exports = {
  canAddSubscribers,
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
  getChannelsOnSocket,
  getDiagnosticsChannel,
  getMaintainers,
  getChannelsSortedBySize,
  getMemberPhoneNumbers,
  getMembersExcept,
  getMemberPhoneNumbersExcept,
  getSocketId,
  getStaleChannels,
  getSubscriberMemberships,
  getSubscriberPhoneNumbers,
  isMaintainer,
  update,
  updateSocketIds,
}
