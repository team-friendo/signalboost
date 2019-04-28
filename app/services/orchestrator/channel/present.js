const channelRepository = require('../../../db/repositories/channel')
const { statuses } = require('../../../constants')
const { pick } = require('lodash')

const list = db =>
  channelRepository
    .findAllDeep(db)
    .then(chs => ({
      status: statuses.SUCCESS,
      data: {
        count: chs.length,
        channels: chs.map(formatForList),
      },
    }))
    .catch(error => ({ status: statuses.ERROR, data: { error } }))

const formatForList = ch => ({
  ...pick(ch, ['name', 'phoneNumber']),
  publishers: ch.publications.length,
  subscribers: ch.subscriptions.length,
  messageCount: pick(ch.messageCount, ['broadcastOut', 'commandIn']),
})

module.exports = { list }
