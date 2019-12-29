const signal = require('../../services/signal')
const channelRepository = require('../../db/repositories/channel')
const membershipRepository = require('../../db/repositories/membership')
const { wait, loggerOf } = require('../util')
const logger = loggerOf('safetyNumberService')
const { messagesIn } = require('../dispatcher/strings/messages')
const { defaultErrorOf } = require('../util')
const { sdMessageOf } = require('../signal')
const {
  signal: { resendDelay },
} = require('../../config')

// (Database, Socket, string, string, string?, SdMessage) -> Promise<SignalboostStatus>
const trustAndResend = async (db, sock, updatableFingerprint) => {
  const { channelPhoneNumber, memberPhoneNumber, fingerprint, sdMessage } = updatableFingerprint
  const trustResult = await signal.trust(sock, channelPhoneNumber, memberPhoneNumber, fingerprint)
  if (sdMessage) {
    // if there is a failed message to be re-sent, resend it, waiting a brief interval for key re-trusting to complete
    await wait(resendDelay).then(() => signal.sendMessage(sock, memberPhoneNumber, sdMessage))
  }
  return trustResult
}

// (Database, socket, string, string) -> Promise<SignalBoostStatus>
const deauthorize = async (db, sock, channelPhoneNumber, numberToDeauthorize) => {
  const removalResult = await membershipRepository
    .removeAdmin(db, channelPhoneNumber, numberToDeauthorize)
    .catch(e => Promise.reject(defaultErrorOf(e)))
  const channel = await channelRepository
    .findDeep(db, channelPhoneNumber)
    .catch(e => Promise.reject(defaultErrorOf(e)))
  await _sendDeauthAlerts(
    sock,
    channelPhoneNumber,
    numberToDeauthorize,
    channelRepository.getAdminMemberships(channel),
  )
  return removalResult
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
