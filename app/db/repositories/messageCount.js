// (Database, string, number) -> Promise<MessageCount>
const incrementBroadcastCount = async (db, phoneNumber, subscriberCount) =>
  db.messageCount
    .increment({ broadcastIn: 1, broadcastOut: subscriberCount }, { where: { phoneNumber } })
    .then(x => x[0][0][0])

// (Database, string) -> Promise<MessageCount>
const incrementCommandCount = async (db, phoneNumber) =>
  db.messageCount
    .increment({ commandIn: 1, commandOut: 1 }, { where: { phoneNumber } })
    .then(x => x[0][0][0])

module.exports = { incrementBroadcastCount, incrementCommandCount }
