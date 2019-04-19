const { pick } = require('lodash')

const list = channels => ({
  count: channels.length,
  channels: channels.map(ch => ({
    ...pick(ch.get(), ['name', 'phoneNumber']),
    admins: ch.administrations.length,
    subscribers: ch.subscriptions.length,
    messageCount: pick(ch.messageCount, ['broadcastOut', 'commandIn']),
  })),
})

module.exports = { list }
