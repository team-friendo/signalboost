const { messageTypes } = require('./constants')
const util = require('../util')
const { statuses } = util
const { get } = require('lodash')
const {
  signal: { signaldRequestTimeout },
} = require('../config')

/**
 * type Callback = (
 *   IncomingSignaldMessage,
 *   resolve: (any) => void,
 *   reject: (any) => void,
 * ) => Promise<SignalboostStatus>,
 *
 * type CallbackRegistry {
 *   [string]: {
 *     callback: Callback,
 *     resolve: Promise.
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

// (SingaldMessageType, string, function, function) -> Promise<void>
const register = async (messageType, id, resolve, reject) => {
  registry[`${messageType}-${id}`] = { callback: _callbackFor(messageType), resolve, reject }
  return util.wait(signaldRequestTimeout).then(() => {
    // delete expired callbacks and reject their promise if not yet handled
    delete registry[`${messageType}-${id}`]
    reject({ status: statuses.ERROR, message: messages.timeout(messageType) })
  })
}

// string -> (IncomingSignaldMessage, resolve, reject) -> Promise<SignalboostStatus>
const _callbackFor = messageType =>
  ({
    [messageTypes.VERIFY]: _handleVerifyResponse,
    [messageTypes.TRUST]: _handleTrustResponse,
    [messageTypes.VERSION]: _handleVersionResponse,
  }[messageType])

// IncomingSignaldMessage -> CallbackRoute
const handle = inSdMsg => {
  const { callback, resolve, reject } = {
    [messageTypes.TRUSTED_FINGERPRINT]:
      registry[`${messageTypes.TRUST}-${get(inSdMsg, 'data.request.fingerprint')}`],
    [messageTypes.VERIFICATION_SUCCESS]:
      registry[`${messageTypes.VERIFY}-${get(inSdMsg, 'data.username')}`],
    [messageTypes.VERIFICATION_ERROR]:
      registry[`${messageTypes.VERIFY}-${get(inSdMsg, 'data.username')}`],
    [messageTypes.VERSION]: registry[`${messageTypes.VERSION}-0`],
  }[inSdMsg.type] || { callback: util.noop }
  callback(inSdMsg, resolve, reject)
}

// CALLBACKS

// (IncomingSignaldMessage, function) -> void
const _handleTrustResponse = (inSdMsg, resolve) => {
  const channelPhoneNumber = inSdMsg.data.request.username
  const memberPhoneNumber = inSdMsg.data.request.recipientNumber
  resolve({
    status: statuses.SUCCESS,
    message: messages.trust.success(channelPhoneNumber, memberPhoneNumber),
  })
}

// (IncomingSignaldMessage, function, function) -> void
const _handleVerifyResponse = (inSdMsg, resolve, reject) => {
  if (inSdMsg.type === messageTypes.VERIFICATION_ERROR)
    reject(
      new Error(
        messages.verification.error(
          get(inSdMsg, 'data.username', 'N/A'),
          get(inSdMsg, 'data.message', 'Captcha required: 402'),
        ),
      ),
    )
  if (inSdMsg.type === messageTypes.VERIFICATION_SUCCESS)
    resolve({
      status: statuses.SUCCESS,
      message: get(inSdMsg, 'data.username', 'N/A'),
    })
}

const _handleVersionResponse = (inSdMsg, resolve) =>
  resolve({
    status: statuses.SUCCESS,
    message: get(inSdMsg, 'data.version', 'N/A'),
  })

module.exports = {
  messages,
  registry,
  clear,
  handle,
  register,
  _handleTrustResponse,
  _handleVerifyResponse,
  _handleVersionResponse,
}
