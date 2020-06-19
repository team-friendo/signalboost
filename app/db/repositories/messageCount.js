const app = require('../../../app')
const { getAdminMemberships } = require('./channel')

//TODO(auguestuser|2020-01-10): tally all these in prometheus once implemented

// (Database, Channel) -> Promise<MessageCount>
const countBroadcast = async channel =>
  app.db.messageCount
    .increment(
      { broadcastIn: 1, broadcastOut: channel.memberships.length },
      { where: { channelPhoneNumber: channel.phoneNumber } },
    )
    .then(x => x[0][0][0])

// (Database, Channel) -> Promise<MessageCount>
const countCommand = async channel =>
  app.db.messageCount
    .increment(
      { commandIn: 1, commandOut: 1 },
      { where: { channelPhoneNumber: channel.phoneNumber } },
    )
    .then(x => x[0][0][0])

// (Database, Channel) -> Promise<MessageCount>
const countHotline = async channel =>
  app.db.messageCount
    .increment(
      { hotlineIn: 1, hotlineOut: getAdminMemberships(channel).length },
      { where: { channelPhoneNumber: channel.phoneNumber } },
    )
    .then(x => x[0][0][0])

module.exports = { countBroadcast, countCommand, countHotline }
