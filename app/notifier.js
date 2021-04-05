const channelRepository = require('./db/repositories/channel')
const signal = require('./signal')
const { sequence } = require('./util')
const { getAdminMemberships, getSubscriberMemberships } = require('./db/repositories/channel')
const { messagesIn } = require('./dispatcher/strings/messages')
const { sdMessageOf } = require('./signal/constants')
const {
  signal: { diagnosticsPhoneNumber },
} = require('./config')

const notificationKeys = {
  CHANNEL_DESTRUCTION_SCHEDULED: 'channelDestructionScheduled',
  CHANNEL_DESTROYED_BY_ADMIN: 'channelDestroyedByAdmin',
  CHANNEL_DESTROYED_BY_SYSTEM: 'channelDestroyedBySystem',
  CHANNEL_REDEEMED: 'channelRedeemed',
}

// (Channel, String, String) -> Promise<Array<string>>
const notifyMembersExcept = async (channel, sender, notificationKey) => {
  const recipients = channelRepository.getMembersExcept(channel, [sender])
  return notifyMany({ channel, notificationKey, recipients })
}

// (string) -> Promise<Array<string>>
const notifyMaintainers = async message => {
  if (!diagnosticsPhoneNumber) return Promise.resolve([])
  const channel = await channelRepository.findDeep(diagnosticsPhoneNumber)
  const recipients = getAdminMemberships(channel)
  return notifyMany({ channel, recipients, message })
}

// (string, string) -> Promise<Array<string>>
const notifyAdmins = async (channel, notificationKey, args) =>
  notifyMany({ channel, notificationKey, args, recipients: getAdminMemberships(channel) })

// (string, string) -> Promise<Array<string>>
const notifySubscribers = async (channel, notificationKey, args) =>
  notifyMany({ channel, notificationKey, args, recipients: getSubscriberMemberships(channel) })

// (Channel, string) -> Promise<Array<string>>
const notifyMembers = async (channel, notificationKey, args) =>
  notifyMany({ channel, notificationKey, args, recipients: channel.memberships })

// (Channel, Array<Member>, string, string, Array<any>) => Promise<Array<string>>
const notifyMany = ({ channel, recipients, notificationKey, message, args }) =>
  // TODO(aguestuser|2020-09-11):
  //  we sequence these to get around signald concurrency bugs, eventually use Promise.all here
  sequence(
    recipients.map(recipient => () =>
      signal.sendMessage(
        sdMessageOf({
          sender: channel.phoneNumber,
          recipient: recipient.memberPhoneNumber,
          message: _messageOf(recipient, message, notificationKey, args), //message || messagesIn(recipient.language).notifications[notificationKey],
          expiresInSeconds: channel.messageExpiryTime,
        }),
        channel.socketId,
      ),
    ),
  )

const _messageOf = (recipient, message, notificationKey, args = []) => {
  if (message) return message
  const notificationMaker = messagesIn(recipient.language).notifications[notificationKey]
  return typeof notificationMaker === 'function' ? notificationMaker(...args) : notificationMaker
}

module.exports = {
  notifyAdmins,
  notifySubscribers,
  notifyMany,
  notifyMembers,
  notifyMaintainers,
  notifyMembersExcept,
  notificationKeys,
}
