const channelRepository = require('../db/repositories/channel')
const membershipRepository = require('../db/repositories/membership')
const { memberTypes } = membershipRepository
const deauthorizationRepository = require('../db/repositories/deauthorization')
const { loggerOf } = require('../util')
const logger = loggerOf('safetyNumberService')
const { messagesIn } = require('../dispatcher/strings/messages')
const { statuses } = require('../util')
const { sdMessageOf } = require('../signal/constants')

/** UpdatableFingerprint -> Promsie<SignalboostStatus> **/
const updateFingerprint = async updatableFingerprint => {
  // TODO(aguestuser|2020-07-09): add a metrics counter here to monitor rekey successes/errors?
  const { channelPhoneNumber, memberPhoneNumber } = updatableFingerprint
  try {
    const type = await membershipRepository.resolveMemberType(channelPhoneNumber, memberPhoneNumber)
    if (type === memberTypes.ADMIN) return deauthorize(updatableFingerprint)
    return trustAndResend(updatableFingerprint)
  } catch (e) {
    logger.error(e)
    return { status: statuses.ERROR, message: e.message }
  }
}

// UpdatableFingerprint -> Promise<SignalboostStatus>
const trustAndResend = async updatableFingerprint => {
  const signal = require('../signal')
  const { channelPhoneNumber, memberPhoneNumber, fingerprint, sdMessage } = updatableFingerprint
  const trustResult = await signal.trust(channelPhoneNumber, memberPhoneNumber, fingerprint)
  const channel = await channelRepository.findByPhoneNumber(channelPhoneNumber)
  if (sdMessage) await signal.sendMessage(sdMessage, channel.socketPoolId)
  return trustResult // we catch errors in `updateFingerPrint`
}

// (Database, Socket, UpdatableFingerprint) -> Promise<SignalBoostStatus>
const deauthorize = async updatableFingerprint => {
  const { channelPhoneNumber, memberPhoneNumber, fingerprint } = updatableFingerprint
  try {
    const channel = await channelRepository.findDeep(channelPhoneNumber)
    const removalResult = await membershipRepository.removeMember(
      channelPhoneNumber,
      memberPhoneNumber,
    )
    await deauthorizationRepository.create(channelPhoneNumber, memberPhoneNumber, fingerprint)
    await _sendDeauthAlerts(
      channel,
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

const _sendDeauthAlerts = (channel, deauthorizedNumber, adminMemberships) => {
  const signal = require('../signal')
  return Promise.all(
    adminMemberships.map(({ memberPhoneNumber, language }) =>
      signal.sendMessage(
        sdMessageOf({
          sender: channel.phoneNumber,
          recipient: memberPhoneNumber,
          message: messagesIn(language).notifications.deauthorization(deauthorizedNumber),
        }),
        channel.socketPoolId,
      ),
    ),
  )
}

module.exports = { updateFingerprint, trustAndResend, deauthorize, logger }
