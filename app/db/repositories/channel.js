// PUBLIC FUNCTIONS

// CHANNEL QUERIES
const updateOrCreate = async (db, phoneNumber, name, containerId) => {
  const channel = await findByPhoneNumber(db, phoneNumber)
  return channel
    ? channel.update({ name, containerId })
    : db.channel.create({ phoneNumber, name, containerId })
}

const findAll = db => db.channel.findAll()
const findByPhoneNumber = (db, phoneNumber) => db.channel.findOne({ where: { phoneNumber } })

// CHANNEL ASSOCIATION QUERIES

const addAdmins = (db, channelPhoneNumber, adminNumbers = []) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    Promise.all(
      adminNumbers.map(humanPhoneNumber =>
        Promise.all([
          db.administration
            .findOrCreate({ where: { channelPhoneNumber, humanPhoneNumber } })
            .spread(x => x),
          db.subscription
            .findOrCreate({ where: { channelPhoneNumber, humanPhoneNumber } })
            .spread(x => x),
        ]).then(writes => writes[0]),
      ),
    ),
  )

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

// HELPERS

const performOpIfChannelExists = async (db, channelPhoneNumber, opDescription, op) => {
  const ch = await db.channel.findOne({
    where: { phoneNumber: channelPhoneNumber },
    include: [{ model: db.subscription }],
  })
  return ch ? op(ch) : Promise.reject(`cannot ${opDescription} non-existent channel`)
}

module.exports = {
  addAdmins,
  addSubscriber,
  updateOrCreate,
  findAll,
  findByPhoneNumber,
  getSubscriberNumbers,
  isAdmin,
  isSubscriber,
  removeSubscriber,
}
