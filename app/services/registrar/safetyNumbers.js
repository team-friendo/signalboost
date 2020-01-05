const signal = require('../../services/signal')
const channelRepository = require('../../db/repositories/channel')
const membershipRepository = require('../../db/repositories/membership')
const deauthorizationRepository = require('../../db/repositories/deauthorization')
const { loggerOf } = require('../util')
const logger = loggerOf('safetyNumberService')
const { messagesIn } = require('../dispatcher/strings/messages')
const { sdMessageOf } = require('../signal')
const { statuses } = require('../../constants')

// (Database, Socket, string, string, string?, SdMessage) -> Promise<SignalboostStatus>
const trustAndResend = async (db, sock, updatableFingerprint) => {
  const { channelPhoneNumber, memberPhoneNumber, fingerprint, sdMessage } = updatableFingerprint
  const trustResult = await signal.trust(sock, channelPhoneNumber, memberPhoneNumber, fingerprint)
  if (sdMessage) {
    await signal.sendMessage(sock, memberPhoneNumber, sdMessage)
  }
  return trustResult
}

// (Database, Socket, UpdatableFingerprint) -> Promise<SignalBoostStatus>
const deauthorize = async (db, sock, updatableFingerprint) => {
  const { channelPhoneNumber, memberPhoneNumber, fingerprint } = updatableFingerprint
  try {
    const channel = await channelRepository.findDeep(db, channelPhoneNumber)
    const removalResult = await membershipRepository.removeAdmin(
      db,
      channelPhoneNumber,
      memberPhoneNumber,
    )
    await deauthorizationRepository.create(db, channelPhoneNumber, memberPhoneNumber, fingerprint)
    await _sendDeauthAlerts(
      sock,
      channelPhoneNumber,
      memberPhoneNumber,
      channelRepository.getAllAdminsExcept(channel, [memberPhoneNumber]),
    )
    return removalResult
  } catch (e) {
    return Promise.reject({
      status: statuses.ERROR,
      message: `Error deauthorizing ${memberPhoneNumber} on ${channelPhoneNumber}: ${e.message}`,
    })
  }
}

const _sendDeauthAlerts = (sock, channelPhoneNumber, deauthorizedNumber, adminMemberships) =>
  Promise.all(
    adminMemberships.map(({ memberPhoneNumber, language }) =>
      signal.sendMessage(
        sock,
        memberPhoneNumber,
        sdMessageOf(
          { phoneNumber: channelPhoneNumber },
          messagesIn(language).notifications.deauthorization(deauthorizedNumber),
        ),
      ),
    ),
  )

module.exports = { trustAndResend, deauthorize, logger }
