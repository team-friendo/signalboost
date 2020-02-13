const { pick } = require('lodash')
const { statuses } = require('../../../db/models/phoneNumber')
const channelRepository = require('../../../db/repositories/channel')
const signal = require('../../signal')
const { defaultLanguage } = require('../../../config')
const { messagesIn } = require('../../dispatcher/strings/messages')
const {
  twilio: { accountSid, authToken },
  signal: { signupPhoneNumber },
} = require('../../../config')

// STRINGS

const errors = {
  searchEmpty: 'search returned empty list',
  searchFailed: err => `twilio number search failed: ${err}`,
  dbWriteFailed: err => `database write failed: ${err}`,
  purchaseFailed: err => `twilio phone number purchase failed: ${err}`,
  registrationFailed: err => `signal registration failed: ${err}`,
  verificationFailed: err => `signal verification failed: ${err}`,
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

// (Database, Socket, Channel, String, String) -> Promise<void>
const notifyMembersExcept = async (db, sock, channel, message, sender) => {
  if (channel == null) return
  const memberPhoneNumbers = channelRepository.getMemberPhoneNumbersExcept(channel, [sender])
  await signal.broadcastMessage(sock, memberPhoneNumbers, signal.sdMessageOf(channel, message))
}

// (DB, Socket, String) -> Promise<void>
const notifyMaintainers = async (db, sock, message) => {
  const adminChannel = await channelRepository.findDeep(db, signupPhoneNumber)
  const adminPhoneNumbers = channelRepository.getAdminPhoneNumbers(adminChannel)
  await signal.broadcastMessage(sock, adminPhoneNumbers, signal.sdMessageOf(adminChannel, message))
}

// (DB, Socket, ChannelInstance, String) -> Promise<void>
const destroyChannel = async (db, sock, channel, message) => {
  if (channel == null) return
  try {
    await channel.destroy()
  } catch (error) {
    await notifyMaintainers(db, sock, message)
    await Promise.reject('Failed to destroy channel')
  }
}

// () -> TwilioInstance
const getTwilioClient = () => require('twilio')(accountSid, authToken)

module.exports = {
  errors,
  statuses,
  errorStatus,
  extractStatus,
  notifyMaintainers,
  notifyMembersExcept,
  destroyChannel,
  getTwilioClient,
}
