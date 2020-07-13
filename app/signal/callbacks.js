const membershipRepository = require('../db/repositories/membership')
const { memberTypes } = membershipRepository
const safetyNumbers = require('../registrar/safetyNumbers')
const metrics = require('../metrics')
const { gauges, histograms } = metrics
const { messageTypes } = require('./constants')
const util = require('../util')
const { statuses } = util
const { get } = require('lodash')
const {
  signal: { signaldRequestTimeout, signaldSendTimeout },
} = require('../config')

/**
 * type Callback = ({
 *   message: IncomingSignaldMessage | SendResponse,
 *   ?resolve: (any) => void,
 *   ?reject: (any) => void,
 *   ?state: CbState,
 * }) => void | Promise<void>
 *
 * type CbState = {
 *   ?channelPhoneNumber: string,
 *   ?messageBody: string,
 *   ?attachments: Array<SignaldOutboundAttachment>,
 *   ?whenSent: number, // millis since epoch
 * }
 * type CallbackRegistry {
 *   [id: string]: {
 *     callback: Callback,
 *     resolve: ((any) => void) | null,
 *     reject: ((any) => void) | null,
 *     state: object | null,
 *   }
 * }
 ***/

const logger = util.loggerOf('signal.callbacks')

const messages = {
  timeout: messageType => `Singald response timed out for request of type: ${messageType}`,
  verification: {
    error: (phoneNumber, reason) =>
      `Signal registration failed for ${phoneNumber}. Reason: ${reason}`,
  },
  trust: {
    error: (channelPhoneNumber, memberPhoneNumber, msg) =>
      `Failed to trust new safety number for ${memberPhoneNumber} on channel ${channelPhoneNumber}: ${msg}`,
    success: (channelPhoneNumber, memberPhoneNumber) =>
      `Trusted new safety number for ${memberPhoneNumber} on channel ${channelPhoneNumber}.`,
  },
}

// CallbackRegistry
const registry = {}
const clear = () => Object.keys(registry).forEach(k => delete registry[k])

// ({ messageType: SingaldMessageType, id: string, resolve: function, reject: function, state: object }) -> Promise<void>
const register = async ({ messageType, id, resolve, reject, state }) => {
  registry[`${messageType}-${id}`] = { callback: _callbackFor(messageType), resolve, reject, state }
  const timeout = messageType === messageTypes.SEND ? signaldSendTimeout : signaldRequestTimeout
  return util.wait(timeout).then(() => {
    // delete expired callbacks and reject their promise if not yet handled
    delete registry[`${messageType}-${id}`]
    reject && reject({ status: statuses.ERROR, message: messages.timeout(messageType) })
  })
}

// SignaldMessageType -> Callback
const _callbackFor = messageType =>
  ({
    [messageTypes.SEND]: _handleSendResponse,
    [messageTypes.TRUST]: _handleTrustResponse,
    [messageTypes.VERIFY]: _handleVerifyResponse,
  }[messageType])

// (IncomingSignaldMessage | SendResponse) -> CallbackRoute
const handle = message => {
  // called from dispatcher.relay
  const { callback, resolve, reject, state } = {
    [messageTypes.TRUSTED_FINGERPRINT]: registry[`${messageTypes.TRUST}-${message.id}`],
    [messageTypes.VERIFICATION_SUCCESS]:
      registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`],
    [messageTypes.VERIFICATION_ERROR]:
      registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`],
    [messageTypes.VERSION]: registry[`${messageTypes.VERSION}-${message.id}`],
    [messageTypes.SEND_RESULTS]: registry[`${messageTypes.SEND}-${message.id}`],
  }[message.type] || { callback: util.noop }
  callback({ message, resolve, reject, state })
}

// CALLBACKS

const _handleSendResponse = ({ message, state }) => {
  delete registry[`${messageTypes.SEND}-${message.id}`]

  const { identityFailure } = get(message, 'data[0]')
  if (identityFailure) {
    return _updateFingerprint(message, state)
  }

  _measureRoundTrip(state)
}

// (SendResult, CbState) => void
const _updateFingerprint = async (message, state) => {
  const { address, identityFailure } = message.data[0]
  const memberPhoneNumber = address.number
  const { channelPhoneNumber, messageBody } = state

  const updatableFingerprint = {
    channelPhoneNumber,
    memberPhoneNumber,
    fingerprint: identityFailure.replace(/\(byte\)0x/g, '').replace(/,/g, ''),
    sdMessage: { type: messageTypes.SEND, username: channelPhoneNumber, messageBody },
  }

  try {
    const type = await membershipRepository.resolveMemberType(channelPhoneNumber, memberPhoneNumber)
    // TODO(aguestuser|2020-07-09): add a metrics counter here to monitor rekey successes/errors?
    if (type === memberTypes.ADMIN) await safetyNumbers.deauthorize(updatableFingerprint)
    if (type === memberTypes.SUBSCRIBER) await safetyNumbers.trustAndResend(updatableFingerprint)
  } catch (e) {
    logger.error(e)
  }
}

// CbState => void
const _measureRoundTrip = ({ channelPhoneNumber, whenSent }) => {
  const elapsed = util.nowInMillis() - whenSent
  metrics.setGauge(gauges.MESSAGE_ROUNDTRIP, elapsed, [channelPhoneNumber])
  metrics.observeHistogram(histograms.MESSAGE_ROUNDTRIP, elapsed, [channelPhoneNumber])
}

// (IncomingSignaldMessage, function) -> void
const _handleTrustResponse = ({ message, resolve }) => {
  const channelPhoneNumber = get(message, 'data.request.username')
  const memberPhoneNumber = get(message, 'data.request.recipientAddress.number')
  resolve({
    status: statuses.SUCCESS,
    message: messages.trust.success(channelPhoneNumber, memberPhoneNumber),
  })
}

// (IncomingSignaldMessage, function, function) -> void
const _handleVerifyResponse = ({ message, resolve, reject }) => {
  if (message.type === messageTypes.VERIFICATION_ERROR)
    reject(
      new Error(
        messages.verification.error(
          get(message, 'data.username', 'N/A'),
          get(message, 'data.message', 'Captcha required: 402'),
        ),
      ),
    )
  if (message.type === messageTypes.VERIFICATION_SUCCESS)
    resolve({
      status: statuses.SUCCESS,
      message: get(message, 'data.username', 'N/A'),
    })
}

module.exports = {
  messages,
  registry,
  clear,
  handle,
  register,
  _handleSendResponse,
  _handleTrustResponse,
  _handleVerifyResponse,
}
