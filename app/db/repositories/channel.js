const { memberTypes } = require('./membership')

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
    .then(([_, [pNumInstance]]) => pNumInstance)

const findAll = db => db.channel.findAll()

const findAllDeep = db =>
  db.channel.findAll({
    order: [[db.messageCount, 'broadcastOut', 'DESC']],
    // order: [[db.messageCount, 'broadcastIn', 'DESC'], [db.messageCount, 'commandIn', 'DESC']],
    include: [{ model: db.membership }, { model: db.messageCount }],
  })

const findByPhoneNumber = (db, phoneNumber) => db.channel.findOne({ where: { phoneNumber } })

const findDeep = (db, phoneNumber) =>
  db.channel.findOne({
    where: { phoneNumber },
    include: [{ model: db.membership }, { model: db.messageCount }],
  })

module.exports = {
  create,
  findAll,
  findAllDeep,
  findByPhoneNumber,
  findDeep,
  update,
}
