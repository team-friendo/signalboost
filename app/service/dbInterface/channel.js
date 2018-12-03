const addSubscriber = async (db, channelPhoneNumber, humanPhoneNumber) =>
  (await db.channel.findOne({ where: { phoneNumber: channelPhoneNumber } }))
    ? db.subscription.create({ channelPhoneNumber, humanPhoneNumber })
    : Promise.reject('cannot subscribe human to non-existent channel')

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

module.exports = { addSubscriber, getSubscriberNumbers, isAdmin }
