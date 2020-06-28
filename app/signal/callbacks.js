const { messageTypes } = require('./constants')
const util = require('../util')
const { statuses, wait } = util
const { get } = require('lodash')
const {
  signal: { signaldRequestTimeout },
} = require('../config')

/**
 * type CallbackRoute = {
 *   socket: Socket,
 *   callback: (IncomingSignaldMessage, resolve, reject) -> Promise<SignalboostStatus>
 * }
 *
 * type CallbackRegistry {
 *   [string]: CallbackRoute
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

// (SingaldMessageType, string, function, function) -> Promise<void>
const register = async (messageType, id, resolve, reject) => {
  registry[`${messageType}-${id}`] = { callback: _callbackFor(messageType), resolve, reject }
  return util
    .wait(signaldRequestTimeout)
    .then(() => reject({ status: statuses.ERROR, message: messages.timeout(messageType) }))
}

const _callbackFor = messageType =>
  ({
    [messageTypes.TRUST]: _handleTrustResponse,
  }[messageType])

// IncomingSignaldMessage -> CallbackRoute
const handle = inSdMsg => {
  // insert safe parsing logic here (to make sure we have a type)
  const { callback, resolve, reject } = {
    [messageTypes.TRUSTED_FINGERPRINT]:
      registry[`${messageTypes.TRUST}-${get(inSdMsg, 'data.request.fingerprint')}`],
  }[inSdMsg.type] || { callback: util.noop }
  callback(inSdMsg, resolve, reject)
}

// CALLBACKS

// (Socket, IncomingSignaldMessage) -> Promise<SignaldStatus>
const _handleTrustResponse = (inSdMsg, resolve) => {
  const channelPhoneNumber = inSdMsg.data.request.username
  const memberPhoneNumber = inSdMsg.data.request.recipientNumber
  resolve({
    status: statuses.SUCCESS,
    message: messages.trust.success(channelPhoneNumber, memberPhoneNumber),
  })
}

module.exports = { messages, registry, register, handle, _handleTrustResponse }
