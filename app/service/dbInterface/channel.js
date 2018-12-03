const addSubscriber = async (db, channelPhoneNumber, humanPhoneNumber) =>
  (await db.channel.findOne({ where: { phoneNumber: channelPhoneNumber } }))
    ? db.subscription.create({ channelPhoneNumber, humanPhoneNumber })
    : Promise.reject('cannot subscribe human to non-existent channel')

const getSubscriberNumbers = (db, phoneNumber) =>
  db.channel
    .findOne({
      where: { phoneNumber },
      include: [{ model: db.subscription }],
    })
    .then(c =>
      c
        ? c.subscriptions.map(s => s.humanPhoneNumber)
        : Promise.reject('cannot retrieve subscriptions to non-existent channel'),
    )

module.exports = { addSubscriber, getSubscriberNumbers }
