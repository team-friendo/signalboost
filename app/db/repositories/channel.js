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

const addPublishers = (db, channelPhoneNumber, publisherNumbers = []) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    Promise.all(publisherNumbers.map(num => addPublisher(db, channelPhoneNumber, num))),
  )

const addPublisher = (db, channelPhoneNumber, publisherPhoneNumber) =>
  db.publication
    .findOrCreate({ where: { channelPhoneNumber, publisherPhoneNumber } })
    .spread(x => x)

const removePublisher = (db, channelPhoneNumber, publisherPhoneNumber) =>
  db.publication.destroy({ where: { channelPhoneNumber, publisherPhoneNumber } })

const addSubscriber = async (db, channelPhoneNumber, subscriberPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    db.subscription.create({ channelPhoneNumber, subscriberPhoneNumber }),
  )

const removeSubscriber = async (db, channelPhoneNumber, subscriberPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'unsubscribe human from', async () =>
    db.subscription.destroy({ where: { channelPhoneNumber, subscriberPhoneNumber } }),
  )

const isPublisher = (db, channelPhoneNumber, publisherPhoneNumber) =>
  db.publication.findOne({ where: { channelPhoneNumber, publisherPhoneNumber } }).then(Boolean)

const isSubscriber = (db, channelPhoneNumber, subscriberPhoneNumber) =>
  db.subscription.findOne({ where: { channelPhoneNumber, subscriberPhoneNumber } }).then(Boolean)

const createWelcome = async (db, channelPhoneNumber, welcomedPhoneNumber) =>
  db.welcome.create({ channelPhoneNumber, welcomedPhoneNumber })

// (Database, string) -> Array<string>
const getUnwelcomedPublishers = async (db, channelPhoneNumber) => {
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
  addPublisher,
  addPublishers,
  addSubscriber,
  createWelcome,
  findAll,
  findAllDeep,
  findByPhoneNumber,
  findDeep,
  getUnwelcomedPublishers,
  isPublisher,
  isSubscriber,
  removePublisher,
  removeSubscriber,
  update,
}
