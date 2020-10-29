const { messageTypes } = require('../app/signal/constants')
const util = require('../app/util')
const { statuses } = util
const { get } = require('lodash')
const {
  signal: { signaldVerifyTimeout },
} = require('../app/config')
const logger = require('../app/registrar/logger')

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
  timeout: messageType => `Signald response timed out for request of type: ${messageType}`,
  verification: {
    error: (phoneNumber, reason) =>
      `Signal registration failed for ${phoneNumber}. Reason: ${reason}`,
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
    [messageTypes.VERIFY]: _handleVerifyResponse,
  }[messageType])

// SignaldMessageType => number
const _timeoutFor = messageType =>
  ({
    [messageTypes.VERIFY]: signaldVerifyTimeout,
  }[messageType])

// (IncomingSignaldMessage | SendResponse) -> CallbackRoute
const handle = message => {
  const { callback, resolve, reject, state } = {
    [messageTypes.VERIFICATION_SUCCESS]:
      registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`],
    [messageTypes.VERIFICATION_ERROR]:
      registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`],
  }[message.type] || { callback: util.noop }
  callback({ message, resolve, reject, state })
}

// CALLBACKS

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
  _handleVerifyResponse,
}
