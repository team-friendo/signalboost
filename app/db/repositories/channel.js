const { Op } = require('sequelize')
const { times } = require('lodash')
const { defaultLanguage } = require('../../config')
const { senderTypes } = require('../../constants')

// PUBLIC FUNCTIONS

// CHANNEL QUERIES
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
    : channel.update({ name, publications }, { include })
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
const findAllWithMember = async (db, memberPhoneNumber) =>
  db.channel.findAll({
    include: [
      {
        model: db.subscription,
        required: false, // left inner join
        where: { subscriberPhoneNumber: memberPhoneNumber },
      },
      {
        model: db.publication,
        required: false, // left inner join
        where: { publisherPhoneNumber: memberPhoneNumber },
      },
    ],
  })

const findByPhoneNumber = (db, phoneNumber) => db.channel.findOne({ where: { phoneNumber } })
const findDeep = (db, phoneNumber) =>
  db.channel.findOne({
    where: { phoneNumber },
    include: [{ model: db.subscription }, { model: db.publication }, { model: db.messageCount }],
  })

// CHANNEL ASSOCIATION QUERIES

// TODO(aguestuser|2019-09-21)
//  it would be nicer to extract publications and subscriptions into a memberhsips table
//  then just query the membership table here (and move this function into a memberships repo
const findMembershipsByPhoneNumber = async (db, memberPhoneNumber) => ({
  publications: await db.publication.findAll({
    where: { publisherPhoneNumber: memberPhoneNumber },
  }),
  subscriptions: await db.subscription.findAll({
    where: { subscriberPhoneNumber: memberPhoneNumber },
  }),
})

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

// TODO(aguestuser|2019-09-21): this would be easier with a members table instead of pub/sub tables!
const resolveSenderType = async (db, channelPhoneNumber, senderPhoneNumber) => {
  const [subscriberPhoneNumber, publisherPhoneNumber] = times(2, () => senderPhoneNumber)
  if (await db.publication.findOne({ where: { channelPhoneNumber, publisherPhoneNumber } })) {
    return Promise.resolve(senderTypes.PUBLISHER)
  }
  if (await db.subscription.findOne({ where: { channelPhoneNumber, subscriberPhoneNumber } })) {
    return Promise.resolve(senderTypes.SUBSCRIBER)
  }
  return Promise.resolve(senderTypes.RANDOM)
}

const resolveSenderLanguage = async (db, channelPhoneNumber, senderPhoneNumber, senderType) => {
  const [subscriberPhoneNumber, publisherPhoneNumber] = times(2, () => senderPhoneNumber)
  if (senderType === senderTypes.PUBLISHER) {
    return (await db.publication.findOne({ where: { channelPhoneNumber, publisherPhoneNumber } }))
      .language
  }
  if (senderType === senderTypes.SUBSCRIBER) {
    return (await db.subscription.findOne({ where: { channelPhoneNumber, subscriberPhoneNumber } }))
      .language
  }
  return defaultLanguage
}

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
  create,
  addPublisher,
  addPublishers,
  addSubscriber,
  createWelcome,
  findAll,
  findAllDeep,
  findMembershipsByPhoneNumber,
  findByPhoneNumber,
  findDeep,
  getUnwelcomedPublishers,
  isPublisher,
  isSubscriber,
  removePublisher,
  removeSubscriber,
  resolveSenderType,
  resolveSenderLanguage,
  update,
}
