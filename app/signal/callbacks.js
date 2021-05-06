const safetyNumbers = require('../registrar/safetyNumbers')
const metrics = require('../metrics')
const { histograms } = metrics
const { messageTypes } = require('./constants')
const util = require('../util')
const { sdMessageOf } = require('./constants')
const { statuses } = util
const { get } = require('lodash')
const {
  signal: {
    healthcheckTimeout,
    isAliveTimeout,
    signaldRequestTimeout,
    signaldSendTimeout,
    signaldVerifyTimeout,
  },
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
  const timeout = _timeoutFor(messageType)
  return util.wait(timeout).then(() => {
    // delete expired callbacks and reject their promise if not yet handled
    delete registry[`${messageType}-${id}`]
    reject && reject({ status: statuses.ERROR, message: messages.timeout(messageType) })
  })
}

// SignaldMessageType -> Callback
const _callbackFor = messageType =>
  ({
    [messageTypes.HEALTHCHECK]: _handleHealthcheckResponse,
    [messageTypes.IS_ALIVE]: _handleIsAliveResponse,
    [messageTypes.SEND]: _handleSendResponse,
    [messageTypes.TRUST]: _handleTrustResponse,
    [messageTypes.VERIFY]: _handleVerifyResponse,
  }[messageType])

// SignaldMessageType => number
const _timeoutFor = messageType =>
  ({
    [messageTypes.HEALTHCHECK]: healthcheckTimeout,
    [messageTypes.IS_ALIVE]: isAliveTimeout,
    [messageTypes.SEND]: signaldSendTimeout,
    [messageTypes.TRUST]: signaldRequestTimeout,
    [messageTypes.VERIFY]: signaldVerifyTimeout,
  }[messageType])

// (IncomingSignaldMessage | SendResponse, number) -> CallbackRoute
const handle = (message, socketId) => {
  // called from dispatcher.relay
  const { callback, resolve, reject, state } = {
    [messageTypes.IS_ALIVE]: registry[`${messageTypes.IS_ALIVE}-${message.id}`],
    [messageTypes.MESSAGE]:
      registry[`${messageTypes.HEALTHCHECK}-${_parseHealthcheckResponseId(message)}`],
    [messageTypes.SEND_RESULTS]: registry[`${messageTypes.SEND}-${message.id}`],
    [messageTypes.TRUSTED_FINGERPRINT]: registry[`${messageTypes.TRUST}-${message.id}`],
    [messageTypes.VERIFICATION_SUCCESS]:
      registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`],
    [messageTypes.VERIFICATION_ERROR]:
      registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`],
    // hmm... how to infer the correct socket pool id here?
    [messageTypes.VERSION]: registry[`${messageTypes.VERSION}-${socketId}`],
  }[message.type] || { callback: util.noop }
  callback({ message, resolve, reject, state })
}

// CALLBACKS

const _handleIsAliveResponse = ({ resolve }) => resolve(messageTypes.IS_ALIVE)

const _handleSendResponse = ({ message, state }) => {
  delete registry[`${messageTypes.SEND}-${message.id}`]

  if (get(message, 'data.0.identityFailure')) {
    return _updateFingerprint(message, state)
  }

  _measureRoundTrip(state)
}

// (SendResult, CbState) => void
const _updateFingerprint = async (message, state) => {
  const { address, identityFailure } = message.data[0]
  const memberPhoneNumber = address.number
  const { channelPhoneNumber, messageBody } = state

  await safetyNumbers.updateFingerprint({
    channelPhoneNumber,
    memberPhoneNumber,
    fingerprint: identityFailure,
    sdMessage: sdMessageOf({
      sender: channelPhoneNumber,
      recipient: memberPhoneNumber,
      message: messageBody,
    }),
  })
}

// CbState => void
const _measureRoundTrip = ({ channelPhoneNumber, whenSent }) => {
  const elapsed = util.nowInMillis() - whenSent
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

// ({ message: IncomingSignaldMessage, resolve: function, state: CbState }) => void
const _handleHealthcheckResponse = ({ message, resolve, state }) => {
  delete registry[`${messageTypes.HEALTHCHECK}-${_parseHealthcheckResponseId(message)}`]
  // convert millis to seconds
  resolve((util.nowInMillis() - state.whenSent) / 1000)
}

const _handleVersionResponse = ({ message, resolve }) => {
  delete registry[`${messageTypes.VERSION}-0`]
  resolve(message.data.version)
}

// HELPERS
const _parseHealthcheckResponseId = sdMessage =>
  get(sdMessage, 'data.dataMessage.body', '')
    .replace(messageTypes.HEALTHCHECK_RESPONSE, '')
    .trim()

module.exports = {
  messages,
  registry,
  clear,
  handle,
  register,
  _handleHealthcheckResponse,
  _handleIsAliveResponse,
  _handleSendResponse,
  _handleTrustResponse,
  _handleVerifyResponse,
  _handleVersionResponse,
}
