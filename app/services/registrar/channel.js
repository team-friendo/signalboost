const channelRepository = require('../../db/repositories/channel')
const membershipRepository = require('../../db/repositories/membership')
const phoneNumberRepository = require('../../db/repositories/phoneNumber')
const signal = require('../signal')
const messenger = require('../dispatcher/messenger')
const { pick } = require('lodash')
const { messagesIn } = require('../dispatcher/strings/messages')
const { defaultLanguage } = require('../../config')
const { statuses: pNumStatuses } = require('../../db/models/phoneNumber')
const { statuses: sbStatuses } = require('../../services/util')
const { loggerOf, wait } = require('../util')
const logger = loggerOf()
const {
  signal: { welcomeDelay, defaultMessageExpiryTime, setExpiryInterval },
} = require('../../config')

const welcomeNotificationOf = channelPhoneNumber =>
  messagesIn(defaultLanguage).notifications.welcome(
    messagesIn(defaultLanguage).systemName,
    channelPhoneNumber,
  )

// ({ Database, Socket, string, string }) -> Promise<SignalboostStatus>
const addAdmin = async ({ channelPhoneNumber, adminPhoneNumber }) => {
  await membershipRepository.addAdmin(channelPhoneNumber, adminPhoneNumber)
  const channel = await channelRepository.findByPhoneNumber(channelPhoneNumber)
  await messenger.notify({
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
const create = async ({ phoneNumber, name, admins }) => {
  try {
    await signal.subscribe(phoneNumber)
    const channel = await channelRepository.create(phoneNumber, name, admins)
    await phoneNumberRepository.update(phoneNumber, { status: pNumStatuses.ACTIVE })
    await _welcomeAdmins(channel)
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

// (Socket, Channel) -> Promise<SignalboostStatus>
const _welcomeAdmins = async channel => {
  await wait(welcomeDelay)
  return Promise.all(
    channelRepository.getAdminPhoneNumbers(channel).map(async adminPhoneNumber => {
      await messenger.notify({
        channel,
        notification: {
          recipient: adminPhoneNumber,
          message: welcomeNotificationOf(channel.phoneNumber),
        },
      })
      await wait(setExpiryInterval)
      return signal.setExpiration(channel.phoneNumber, adminPhoneNumber, defaultMessageExpiryTime)
    }),
  )
}

// (Database) -> Promise<Array<Channel>>
const list = db =>
  channelRepository
    .findAllDeep(db)
    .then(chs => ({
      status: sbStatuses.SUCCESS,
      data: {
        count: chs.length,
        // sort by subscribers, desc
        channels: chs.map(_formatForList).sort((a, b) => b.subscribers - a.subscribers),
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
