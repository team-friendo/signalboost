const { pick } = require('lodash')
const { statuses } = require('../../../db/models/phoneNumber')
const channelRepository = require('../../../db/repositories/channel')
const signal = require('../../signal')
const {
  twilio: { accountSid, authToken, smsEndpoint },
  registrar: { host },
  signal: { supportPhoneNumber },
} = require('../../../config')

// STRINGS

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

// (Database, Socket, Channel, String, String) -> Promise<void>
const notifyMembersExcept = async (channel, message, sender) => {
  if (channel == null) return
  const memberPhoneNumbers = channelRepository.getMemberPhoneNumbersExcept(channel, [sender])
  await signal.broadcastMessage(memberPhoneNumbers, signal.sdMessageOf(channel, message))
}

// (DB, Socket, String) -> Promise<void>
const notifyMaintainers = async message => {
  const adminChannel = await channelRepository.findDeep(supportPhoneNumber)
  const adminPhoneNumbers = channelRepository.getAdminPhoneNumbers(adminChannel)
  await signal.broadcastMessage(adminPhoneNumbers, signal.sdMessageOf(adminChannel, message))
}

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
  notifyMaintainers,
  notifyMembersExcept,
  destroyChannel,
  getTwilioClient,
  smsUrl,
}
