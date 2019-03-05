// PUBLIC FUNCTIONS
const create = async (db, phoneNumber, name) => db.channel.create({ phoneNumber, name })

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
  create,
  addSubscriber,
  removeSubscriber,
  getSubscriberNumbers,
  isAdmin,
  isSubscriber,
}
