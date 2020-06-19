const app = require('../../../app')
const { memberTypes } = require('./membership')

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
  findAll,
  findAllDeep,
  findByPhoneNumber,
  findDeep,
  getAllAdminsExcept,
  getAdminMemberships,
  getAdminPhoneNumbers,
  getMemberPhoneNumbers,
  getMemberPhoneNumbersExcept,
  getSubscriberMemberships,
  getSubscriberPhoneNumbers,
  update,
}
