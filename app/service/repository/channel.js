const messages = {
  ALREADY_UNSUBSCRIBED: 'cannot unsubscribe human from channel they are not subscribed to',
}

const addSubscriber = async (db, channelPhoneNumber, humanPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    db.subscription.create({ channelPhoneNumber, humanPhoneNumber }),
  )

const removeSubscriber = async (db, channelPhoneNumber, humanPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'unsubscribe human from', async () =>
    db.subscription.destroy({ where: { channelPhoneNumber, humanPhoneNumber } }),
  )

const getSubscriberNumbers = (db, channelPhoneNumber) =>
  db.channel
    .findOne({
      where: { phoneNumber: channelPhoneNumber },
      include: [{ model: db.subscription }],
    })
    .then(c =>
      c
        ? c.subscriptions.map(s => s.humanPhoneNumber)
        : Promise.reject('cannot retrieve subscriptions to non-existent channel'),
    )

const isAdmin = (db, channelPhoneNumber, humanPhoneNumber) =>
  db.administration.findOne({ where: { channelPhoneNumber, humanPhoneNumber } }).then(Boolean)

const isSubscriber = (db, channelPhoneNumber, humanPhoneNumber) =>
  db.subscription.findOne({ where: { channelPhoneNumber, humanPhoneNumber } }).then(Boolean)

// helpers

const performOpIfChannelExists = async (db, channelPhoneNumber, opDescription, op) =>
  (await db.channel.findOne({ where: { phoneNumber: channelPhoneNumber } }))
    ? op()
    : Promise.reject(`cannot ${opDescription} non-existent channel`)

module.exports = {
  messages,
  addSubscriber,
  removeSubscriber,
  getSubscriberNumbers,
  isAdmin,
  isSubscriber,
}
