const channelRepository = require('../../db/repositories/channel')
const membershipRepository = require('../../db/repositories/membership')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const signal = require('../signal')
const messenger = require('../dispatcher/messenger')
const { pick } = require('lodash')
const { messagesIn } = require('../dispatcher/strings/messages')
const { defaultLanguage } = require('../../config')
const { statuses: pNumStatuses } = require('../../db/models/phoneNumber')
const { statuses: sbStatuses } = require('../../constants')
const { loggerOf, wait } = require('../util')
const logger = loggerOf()
const {
  signal: { welcomeDelay },
} = require('../../config')

const welcomeNotificationOf = channelPhoneNumber =>
  messagesIn(defaultLanguage).notifications.welcome(
    messagesIn(defaultLanguage).systemName,
    channelPhoneNumber,
  )

// ({ Database, Socket, string, string }) -> Promise<SignalboostStatus>
const addAdmin = async ({ db, sock, channelPhoneNumber, publisherPhoneNumber }) => {
  await membershipRepository.addAdmin(db, channelPhoneNumber, publisherPhoneNumber)
  const channel = await channelRepository.findByPhoneNumber(db, channelPhoneNumber)
  await messenger.notify({
    db,
    sock,
    channel,
    notification: welcomeNotificationOf(channelPhoneNumber),
    recipients: [publisherPhoneNumber],
  })
  return {
    status: sbStatuses.SUCCESS,
    message: welcomeNotificationOf(channelPhoneNumber),
  }
}

// ({ Database, Socket, string, string, Array<string> }) -> Promise<ChannelStatus>
const create = async ({ db, sock, phoneNumber, name, publishers }) => {
  try {
    await signal.subscribe(sock, phoneNumber)
    const channel = await channelRepository.create(db, phoneNumber, name, publishers)
    await phoneNumberRepository.update(db, phoneNumber, { status: pNumStatuses.ACTIVE })
    await wait(welcomeDelay)
    await messenger.notify({
      db,
      sock,
      channel,
      notification: welcomeNotificationOf(channel.phoneNumber),
      recipients: channel.publications.map(p => p.publisherPhoneNumber),
    })
    return { status: pNumStatuses.ACTIVE, phoneNumber, name, publishers }
  } catch (e) {
    logger.error(e)
    return {
      status: pNumStatuses.ERROR,
      error: e.message || e,
      request: { phoneNumber, name, publishers },
    }
  }
}

// (Database) -> Promise<Array<Channel>>
const list = db =>
  channelRepository
    .findAllDeep(db)
    .then(chs => ({
      status: sbStatuses.SUCCESS,
      data: {
        count: chs.length,
        channels: chs.map(_formatForList),
      },
    }))
    .catch(error => ({ status: sbStatuses.ERROR, data: { error } }))

const _formatForList = ch => ({
  ...pick(ch, ['name', 'phoneNumber']),
  publishers: ch.publications.length,
  subscribers: ch.subscriptions.length,
  messageCount: pick(ch.messageCount, ['broadcastOut', 'commandIn']),
})

module.exports = {
  create,
  addAdmin,
  list,
}
