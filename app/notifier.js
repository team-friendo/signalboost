const channelRepository = require('./db/repositories/channel')
const signal = require('./signal')
const { sequence } = require('./util')
const { getAdminMemberships } = require('./db/repositories/channel')
const { messagesIn } = require('./dispatcher/strings/messages')
const { sdMessageOf } = require('./signal/constants')
const {
  signal: { diagnosticsPhoneNumber },
} = require('./config')

const notificationKeys = {
  CHANNEL_DESTROYED: 'channelDestroyed',
  CHANNEL_RECYCLED: 'channelRecycled',
  CHANNEL_REDEEMED: 'channelRedeemed',
}

// (Channel, String, String) -> Promise<Array<string>>
const notifyMembersExcept = async (channel, sender, notificationKey) => {
  const recipients = channelRepository.getMembersExcept(channel, [sender])
  return _notifyMany({ channel, notificationKey, recipients })
}

// (string) -> Promise<Array<string>>
const notifyMaintainers = async message => {
  if (!diagnosticsPhoneNumber) return Promise.resolve([])
  const channel = await channelRepository.findDeep(diagnosticsPhoneNumber)
  const recipients = getAdminMemberships(channel)
  return _notifyMany({ channel, recipients, message })
}

// (string, string) -> Promise<Array<string>>
const notifyAdmins = async (channel, notificationKey) =>
  _notifyMany({ channel, notificationKey, recipients: getAdminMemberships(channel) })

// (Channel, string) -> Promise<Array<string>>
const notifyMembers = async (channel, notificationKey) =>
  _notifyMany({ channel, notificationKey, recipients: channel.memberships })

// (Channel, string, Array<Member>) => Promise<Array<string>>
const _notifyMany = ({ channel, recipients, notificationKey, message }) =>
  // TODO(aguestuser|2020-09-11):
  //  we sequence these to get around signald concurrency bugs, eventually use Promise.all here
  sequence(
    recipients.map(recipient => () =>
      signal.sendMessage(
        recipient.memberPhoneNumber,
        message
          ? sdMessageOf(channel, message)
          : sdMessageOf(channel, messagesIn(recipient.language).notifications[notificationKey]),
      ),
    ),
  )

module.exports = {
  notifyAdmins,
  notifyMembers,
  notifyMaintainers,
  notifyMembersExcept,
  notificationKeys,
}
