const channelRepository = require('./db/repositories/channel')
const signal = require('./signal')
const { getAdminMemberships } = require('./db/repositories/channel')
const { getAdminPhoneNumbers } = require('./db/repositories/channel')
const { messagesIn } = require('./dispatcher/strings/messages')
const { sdMessageOf } = require('./signal/constants')
const {
  signal: { supportPhoneNumber },
} = require('./config')

const notificationKeys = {
  CHANNEL_DESTROYED: 'channelDestroyed',
  CHANNEL_RECYCLED: 'channelRecycled',
  CHANNEL_REDEEMED: 'channelRedeemed',
}

// (Database, Socket, Channel, String, String) -> Promise<Array<string>>
const notifyMembersExcept = async (channel, message, sender) => {
  if (channel == null) return
  const memberPhoneNumbers = channelRepository.getMemberPhoneNumbersExcept(channel, [sender])
  await signal.broadcastMessage(memberPhoneNumbers, sdMessageOf(channel, message))
}

// (string) -> Promise<Array<string>>
const notifyMaintainers = async message => {
  if (!supportPhoneNumber) return Promise.resolve([])
  const supportChannel = await channelRepository.findDeep(supportPhoneNumber)
  const maintainerPhoneNumbers = getAdminPhoneNumbers(supportChannel)
  await signal.broadcastMessage(maintainerPhoneNumbers, sdMessageOf(supportChannel, message))
}

// (string, string) -> Promise<Array<string>>
const notifyAdmins = async (channel, notificationKey) =>
  _notifyMany(channel, notificationKey, getAdminMemberships(channel))

// (Channel, string) -> Promise<Array<string>>
const notifyMembers = async (channel, notificationKey) =>
  _notifyMany(channel, notificationKey, channel.memberships)

// (Channel, string, Array<Member>) => Promise<Array<string>>
const _notifyMany = (channel, notificationKey, recipients) =>
  Promise.all(
    recipients.map(recipient =>
      signal.sendMessage(
        recipient.memberPhoneNumber,
        sdMessageOf(channel, messagesIn(recipient.language).notifications[notificationKey]),
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
