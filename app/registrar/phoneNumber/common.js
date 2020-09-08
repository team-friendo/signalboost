const { pick } = require('lodash')
const { statuses } = require('../../db/models/phoneNumber')
const channelRepository = require('../../db/repositories/channel')
const signal = require('../../signal')
const { getAdminMemberships } = require("../../db/repositories/channel")
const { getAdminPhoneNumbers } = require('../../db/repositories/channel')
const { messagesIn } = require('../../dispatcher/strings/messages')
const { sdMessageOf } = require('../../signal/constants')
const {
  twilio: { accountSid, authToken, smsEndpoint },
  api: { host },
  signal: { supportPhoneNumber },
} = require('../../config')

// STRINGS

const notificationKeys = {
  CHANNEL_DESTROYED: 'channelDestroyed',
  CHANNEL_RECYCLED: 'channelRecycled',
}

const errors = {
  searchEmpty: 'search returned empty list',
  searchFailed: err => `twilio number search failed: ${err}`,
  dbWriteFailed: err => `database write failed: ${err}`,
  purchaseFailed: err => `twilio phone number purchase failed: ${err}`,
  registrationFailed: err => `signal registration failed: ${err}`,
  verificationTimeout: 'signal verification timed out',
  invalidIncomingSms: (phoneNumber, msg) => `invalid incoming sms on ${phoneNumber}: ${msg}`,
}

const errorStatus = (error, phoneNumber) => ({
  status: statuses.ERROR,
  phoneNumber,
  error,
})

const extractStatus = phoneNumberInstance =>
  pick(phoneNumberInstance, ['status', 'phoneNumber', 'twilioSid'])

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

// (DB, Socket, ChannelInstance, String) -> Promise<void>
const destroyChannel = async (channel, tx) => {
  if (channel == null) return
  try {
    await channel.destroy({ transaction: tx })
  } catch (error) {
    await Promise.reject('Failed to destroy channel')
  }
}

// () -> TwilioInstance
const getTwilioClient = () => require('twilio')(accountSid, authToken)

const smsUrl = `https://${host}/${smsEndpoint}`

module.exports = {
  errors,
  statuses,
  errorStatus,
  extractStatus,
  notifyAdmins,
  notifyMembers,
  notifyMaintainers,
  notifyMembersExcept,
  notificationKeys,
  destroyChannel,
  getTwilioClient,
  smsUrl,
}
