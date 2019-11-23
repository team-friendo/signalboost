const create = async (db, phoneNumber, name, publishers) => {
  const publications = publishers.map(p => ({ publisherPhoneNumber: p }))
  const channel = await findByPhoneNumber(db, phoneNumber)
  const include = [
    { model: db.messageCount },
    { model: db.subscription },
    { model: db.publication },
  ]
  return !channel
    ? db.channel.create({ phoneNumber, name, publications, messageCount: {} }, { include })
    : channel
        .update({ name, publications, returning: true }, { include })
        .then(c => ({ ...c.dataValues, publications, messageCount: channel.messageCount }))
}

const update = (db, phoneNumber, attrs) =>
  db.channel
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([_, [pNumInstance]]) => pNumInstance)

const findAll = db => db.channel.findAll()

const findAllDeep = db =>
  db.channel.findAll({
    order: [[db.messageCount, 'broadcastOut', 'DESC']],
    include: [{ model: db.subscription }, { model: db.publication }, { model: db.messageCount }],
  })

const findByPhoneNumber = (db, phoneNumber) => db.channel.findOne({ where: { phoneNumber } })

const findDeep = (db, phoneNumber) =>
  db.channel.findOne({
    where: { phoneNumber },
    include: [{ model: db.subscription }, { model: db.publication }, { model: db.messageCount }],
  })

module.exports = {
  create,
  findAll,
  findAllDeep,
  findByPhoneNumber,
  findDeep,
  update,
}
