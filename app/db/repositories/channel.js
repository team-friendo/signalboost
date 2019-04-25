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

// CHANNEL ASSOCIATION QUERIES

const addAdmins = (db, channelPhoneNumber, adminNumbers = []) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    Promise.all(adminNumbers.map(num => addAdmin(db, channelPhoneNumber, num))),
  )

const addAdmin = (db, channelPhoneNumber, publisherPhoneNumber) =>
  Promise.all([
    db.publication
      .findOrCreate({ where: { channelPhoneNumber, publisherPhoneNumber } })
      .spread(x => x),
    db.subscription
      .findOrCreate({ where: { channelPhoneNumber, subscriberPhoneNumber: publisherPhoneNumber } })
      .spread(x => x),
  ]).then(writes => writes[0])

const removeAdmin = (db, channelPhoneNumber, publisherPhoneNumber) =>
  Promise.all([
    db.publication.destroy({ where: { channelPhoneNumber, publisherPhoneNumber } }),
    db.subscription.destroy({
      where: { channelPhoneNumber, subscriberPhoneNumber: publisherPhoneNumber },
    }),
  ])

const addSubscriber = async (db, channelPhoneNumber, subscriberPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    db.subscription.create({ channelPhoneNumber, subscriberPhoneNumber }),
  )

const removeSubscriber = async (db, channelPhoneNumber, subscriberPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'unsubscribe human from', async () =>
    db.subscription.destroy({ where: { channelPhoneNumber, subscriberPhoneNumber } }),
  )

const getSubscriberNumbers = (db, channelPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'retrieve subscriptions to', async ch =>
    ch.subscriptions.map(s => s.subscriberPhoneNumber),
  )

const isAdmin = (db, channelPhoneNumber, publisherPhoneNumber) =>
  db.publication.findOne({ where: { channelPhoneNumber, publisherPhoneNumber } }).then(Boolean)

const isSubscriber = (db, channelPhoneNumber, subscriberPhoneNumber) =>
  db.subscription.findOne({ where: { channelPhoneNumber, subscriberPhoneNumber } }).then(Boolean)

const createWelcome = async (db, channelPhoneNumber, welcomedPhoneNumber) =>
  db.welcome.create({ channelPhoneNumber, welcomedPhoneNumber })

// (Database, string) -> Array<string>
const getUnwelcomedAdmins = async (db, channelPhoneNumber) => {
  const welcomes = await db.welcome.findAll({ where: { channelPhoneNumber } })
  const welcomedNumbers = welcomes.map(w => w.welcomedPhoneNumber)
  const unwelcomed = await db.publication.findAll({
    where: { channelPhoneNumber, publisherPhoneNumber: { [Op.notIn]: welcomedNumbers } },
  })
  return unwelcomed.map(uw => uw.publisherPhoneNumber)
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
  createWelcome,
  findAll,
  findAllDeep,
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
