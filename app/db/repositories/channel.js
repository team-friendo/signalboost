const { memberTypes } = require('./membership')

/***********
 * QUERIES
 ***********/

const create = async (db, phoneNumber, name, adminPhoneNumbers) => {
  const memberships = adminPhoneNumbers.map(pNum => ({
    type: memberTypes.ADMIN,
    memberPhoneNumber: pNum,
  }))
  const channel = await findByPhoneNumber(db, phoneNumber)
  const include = [{ model: db.messageCount }, { model: db.membership }]
  return !channel
    ? db.channel.create({ phoneNumber, name, memberships, messageCount: {} }, { include })
    : channel
        .update({ name, memberships, returning: true }, { include })
        .then(c => ({ ...c.dataValues, memberships, messageCount: channel.messageCount }))
}

const update = (db, phoneNumber, attrs) =>
  db.channel
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([, [pNumInstance]]) => pNumInstance)

const findAll = db => db.channel.findAll()

const findAllDeep = db =>
  db.channel.findAll({
    include: [
      { model: db.deauthorization },
      { model: db.invite },
      { model: db.membership },
      { model: db.messageCount },
    ],
  })

const findByPhoneNumber = (db, phoneNumber) => db.channel.findOne({ where: { phoneNumber } })

const findDeep = (db, phoneNumber) =>
  db.channel.findOne({
    where: { phoneNumber },
    include: [
      { model: db.deauthorization },
      { model: db.invite },
      { model: db.membership },
      { model: db.messageCount },
    ],
  })

/************
 * SELECTORS
 ***********/

// all selectors assume you are operating on an already deeply-fetched channel (with all nested attrs avail)
const getMemberPhoneNumbers = channel => (channel.memberships || []).map(m => m.memberPhoneNumber)
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
  getSubscriberMemberships,
  getSubscriberPhoneNumbers,
  update,
}
