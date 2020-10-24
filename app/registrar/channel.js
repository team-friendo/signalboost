const channelRepository = require('../db/repositories/channel')
const membershipRepository = require('../db/repositories/membership')
const phoneNumberRepository = require('../db/repositories/phoneNumber')
const eventRepository = require('../db/repositories/event')
const inviteRepository = require('../db/repositories/invite')
const signal = require('../signal')
const { eventTypes } = require('../db/models/event')
const { pick } = require('lodash')
const { messagesIn } = require('../dispatcher/strings/messages')
const { defaultLanguage } = require('../config')
const { statuses: pNumStatuses } = require('../db/models/phoneNumber')
const { statuses: sbStatuses, loggerOf, wait, hash } = require('../util')
const logger = loggerOf()
const {
  signal: { welcomeDelay, defaultMessageExpiryTime, setExpiryInterval, supportPhoneNumber },
} = require('../config')
const { sdMessageOf } = require('../signal/constants')

// ({ Database, Socket, string, string }) -> Promise<SignalboostStatus>
const addAdmin = async ({ channelPhoneNumber, adminPhoneNumber }) => {
  await membershipRepository.addAdmin(channelPhoneNumber, adminPhoneNumber)
  const channel = await channelRepository.findByPhoneNumber(channelPhoneNumber)
  const message = _welcomeNotificationOf(channel)
  await signal.sendMessage(
    sdMessageOf({ sender: channelPhoneNumber, recipient: adminPhoneNumber, message }),
    channel.socketId,
  )
  return { status: sbStatuses.SUCCESS, message }
}

/* ({ phoneNumber: string, name: string, admins: Array<string> }) => Promise<ChannelStatus> */
const create = async ({ phoneNumber, name, admins }) => {
  try {
    // create the channel, (assigning it to socket pool 0, since `socketId`'s default value is 0)
    await signal.subscribe(phoneNumber, 0)
    const channel = await channelRepository.create(phoneNumber, name, admins)
    await phoneNumberRepository.update(phoneNumber, { status: pNumStatuses.ACTIVE })
    await eventRepository.log(eventTypes.CHANNEL_CREATED, phoneNumber)

    // send new admins welcome messages
    const adminPhoneNumbers = channelRepository.getAdminPhoneNumbers(channel)
    await wait(welcomeDelay)
    await _sendWelcomeMessages(channel, adminPhoneNumbers)

    // invite admins to subscribe to support channel if one exists
    const supportChannel = await channelRepository.findDeep(supportPhoneNumber)
    if (supportChannel) await _inviteToSupportChannel(supportChannel, adminPhoneNumbers)

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

/* (Channel, Array<string>) -> Promise<Array<void>> */
const _sendWelcomeMessages = async (channel, adminPhoneNumbers) =>
  Promise.all(
    adminPhoneNumbers.map(async adminPhoneNumber => {
      await signal.sendMessage(
        sdMessageOf({
          sender: channel.phoneNumber,
          recipient: adminPhoneNumber,
          message: _welcomeNotificationOf(channel),
        }),
        channel.socketId,
      )
      await wait(setExpiryInterval)
      await signal.setExpiration(
        channel.phoneNumber,
        adminPhoneNumber,
        defaultMessageExpiryTime,
        channel.socketId,
      )
    }),
  )

/* (Channel, Array<string>) => Promise<Array<void>> */
const _inviteToSupportChannel = async (supportChannel, adminPhoneNumbers) => {
  const memberPhoneNumbers = new Set(channelRepository.getMemberPhoneNumbers(supportChannel))
  return Promise.all(
    adminPhoneNumbers.map(async adminPhoneNumber => {
      if (memberPhoneNumbers.has(adminPhoneNumber)) return
      await inviteRepository.issue(
        supportChannel.phoneNumber,
        supportChannel.phoneNumber,
        adminPhoneNumber,
      )
      await signal.sendMessage(
        sdMessageOf({
          sender: supportChannel.phoneNumber,
          recipient: adminPhoneNumber,
          message: _welcomeNotificationOf(supportChannel),
        }),
        supportChannel.socketId,
      )
    }),
  )
}

const _welcomeNotificationOf = channel =>
  messagesIn(defaultLanguage).notifications.welcome(
    messagesIn(defaultLanguage).systemName,
    channel.phoneNumber,
    channel.name,
  )

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
  hash: hash(ch.phoneNumber),
  socketId: ch.socketId,
  admins: channelRepository.getAdminMemberships(ch).length,
  subscribers: channelRepository.getSubscriberMemberships(ch).length,
  messageCount: pick(ch.messageCount, ['broadcastIn', 'commandIn', 'hotlineIn']),
})

module.exports = {
  create,
  addAdmin,
  list,
  _welcomeNotificationOf,
}
