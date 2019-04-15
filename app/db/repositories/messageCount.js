// (Database, string, number) -> Promise<MessageCount>
const incrementBroadcastCount = async (db, channelPhoneNumber, subscriberCount) =>
  db.messageCount
    .increment({ broadcastIn: 1, broadcastOut: subscriberCount }, { where: { channelPhoneNumber } })
    .then(x => x[0][0][0])

// (Database, string) -> Promise<MessageCount>
const incrementCommandCount = async (db, channelPhoneNumber) =>
  db.messageCount
    .increment({ commandIn: 1, commandOut: 1 }, { where: { channelPhoneNumber } })
    .then(x => x[0][0][0])

module.exports = { incrementBroadcastCount, incrementCommandCount }
