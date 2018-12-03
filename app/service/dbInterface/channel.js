const addSubscriber = async (db, channelPhoneNumber, humanPhoneNumber) =>
  (await db.channel.findOne({ where: { phoneNumber: channelPhoneNumber } }))
    ? db.subscription.create({ channelPhoneNumber, humanPhoneNumber })
    : Promise.reject('cannot subscribe human to non-existent channel')

module.exports = { addSubscriber }
