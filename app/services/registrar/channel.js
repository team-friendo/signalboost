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
const addAdmin = async ({ db, sock, channelPhoneNumber, adminPhoneNumber }) => {
  await membershipRepository.addAdmin(db, channelPhoneNumber, adminPhoneNumber)
  const channel = await channelRepository.findByPhoneNumber(db, channelPhoneNumber)
  await messenger.notify({
    sock,
    channel,
    notification: {
      message: welcomeNotificationOf(channelPhoneNumber),
      recipient: adminPhoneNumber,
    },
  })
  return {
    status: sbStatuses.SUCCESS,
    message: welcomeNotificationOf(channelPhoneNumber),
  }
}

// ({ Database, Socket, string, string, Array<string> }) -> Promise<ChannelStatus>
const create = async ({ db, sock, phoneNumber, name, admins }) => {
  try {
    await signal.subscribe(sock, phoneNumber)
    const channel = await channelRepository.create(db, phoneNumber, name, admins)
    await phoneNumberRepository.update(db, phoneNumber, { status: pNumStatuses.ACTIVE })
    await wait(welcomeDelay)
    await Promise.all(
      channelRepository.getAdminPhoneNumbers(channel).map(recipient =>
        messenger.notify({
          sock,
          channel,
          notification: { recipient, message: welcomeNotificationOf(channel.phoneNumber) },
        }),
      ),
    )
    return { status: pNumStatuses.ACTIVE, phoneNumber, name, admins }
  } catch (e) {
    logger.error(e)
    return {
      status: pNumStatuses.ERROR,
      error: e.message || e,
      request: { phoneNumber, name, admins },
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
        channels: chs.map(_formatForList).sort((a, b) => b - a), // sort by subs, desc
      },
    }))
    .catch(error => ({ status: sbStatuses.ERROR, data: { error } }))

const _formatForList = ch => ({
  ...pick(ch, ['name', 'phoneNumber']),
  admins: channelRepository.getAdminMemberships(ch).length,
  subscribers: channelRepository.getSubscriberMemberships(ch).length,
  messageCount: pick(ch.messageCount, ['broadcastIn', 'commandIn', 'hotlineIn']),
})

module.exports = {
  create,
  addAdmin,
  list,
}
