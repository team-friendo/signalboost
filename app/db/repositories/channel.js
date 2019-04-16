const { get } = require('lodash')
const { Op } = require('sequelize')

// PUBLIC FUNCTIONS

// CHANNEL QUERIES
const activate = async (db, phoneNumber, name, containerId) => {
  const channel = await findByPhoneNumber(db, phoneNumber)
  return channel
    ? channel.update({ name, containerId })
    : db.channel.create(
        { phoneNumber, name, containerId, messageCount: {} },
        { include: [{ model: db.messageCount }] },
      )
}

const update = (db, phoneNumber, attrs) =>
  db.channel
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([_, [pNumInstance]]) => pNumInstance)

const findAll = db => db.channel.findAll()

const findByPhoneNumber = (db, phoneNumber) => db.channel.findOne({ where: { phoneNumber } })

const findDeep = (db, phoneNumber) =>
  db.channel.findOne({
    where: { phoneNumber },
    include: [{ model: db.subscription }, { model: db.administration }],
  })

// CHANNEL ASSOCIATION QUERIES

const addAdmins = (db, channelPhoneNumber, adminNumbers = []) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    Promise.all(adminNumbers.map(num => addAdmin(db, channelPhoneNumber, num))),
  )

const addAdmin = (db, channelPhoneNumber, humanPhoneNumber) =>
  Promise.all([
    db.administration
      .findOrCreate({ where: { channelPhoneNumber, humanPhoneNumber } })
      .spread(x => x),
    db.subscription
      .findOrCreate({ where: { channelPhoneNumber, humanPhoneNumber } })
      .spread(x => x),
  ]).then(writes => writes[0])

const removeAdmin = (db, channelPhoneNumber, humanPhoneNumber) =>
  Promise.all([
    db.administration.destroy({ where: { channelPhoneNumber, humanPhoneNumber } }),
    db.subscription.destroy({ where: { channelPhoneNumber, humanPhoneNumber } }),
  ])

const addSubscriber = async (db, channelPhoneNumber, humanPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    db.subscription.create({ channelPhoneNumber, humanPhoneNumber }),
  )

const removeSubscriber = async (db, channelPhoneNumber, humanPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'unsubscribe human from', async () =>
    db.subscription.destroy({ where: { channelPhoneNumber, humanPhoneNumber } }),
  )

const getSubscriberNumbers = (db, channelPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'retrieve subscriptions to', async ch =>
    ch.subscriptions.map(s => s.humanPhoneNumber),
  )

const isAdmin = (db, channelPhoneNumber, humanPhoneNumber) =>
  db.administration.findOne({ where: { channelPhoneNumber, humanPhoneNumber } }).then(Boolean)

const isSubscriber = (db, channelPhoneNumber, humanPhoneNumber) =>
  db.subscription.findOne({ where: { channelPhoneNumber, humanPhoneNumber } }).then(Boolean)

// (Database, string) -> Array<string>
const getUnwelcomedAdmins = async (db, channelPhoneNumber) => {
  const welcomes = await db.welcome.findAll({ where: { channelPhoneNumber } })
  const welcomedNumbers = welcomes.map(w => w.welcomedPhoneNumber)
  const unwelcomed = await db.administration.findAll({
    where: { channelPhoneNumber, humanPhoneNumber: { [Op.notIn]: welcomedNumbers } },
  })
  return unwelcomed.map(uw => uw.humanPhoneNumber)
}

// HELPERS

const performOpIfChannelExists = async (db, channelPhoneNumber, opDescription, op) => {
  const ch = await db.channel.findOne({
    where: { phoneNumber: channelPhoneNumber },
    include: [{ model: db.subscription }],
  })
  return ch ? op(ch) : Promise.reject(`cannot ${opDescription} non-existent channel`)
}

module.exports = {
  activate,
  addAdmin,
  addAdmins,
  addSubscriber,
  findAll,
  findByPhoneNumber,
  findDeep,
  getSubscriberNumbers,
  getUnwelcomedAdmins,
  isAdmin,
  isSubscriber,
  removeAdmin,
  removeSubscriber,
  update,
}
