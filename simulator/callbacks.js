const { messageTypes } = require('../app/signal/constants')
const util = require('../app/util')
const { statuses } = util
const { get } = require('lodash')

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
  timeout: (messageType, id) =>
    `Signald response timed out for request of type: ${messageType}, id: ${id}`,
  verification: {
    error: (phoneNumber, reason) => `Verification failed for ${phoneNumber}. Reason: ${reason}`,
  },
  registration: {
    error: (phoneNumber, reason) => `Registration failed for ${phoneNumber}. Reason: ${reason}`,
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
    reject && reject({ status: statuses.ERROR, message: messages.timeout(messageType, id) })
  })
}

// SignaldMessageType -> Callback
const _callbackFor = messageType =>
  ({
    [messageTypes.REGISTER]: _handleRegisterResponse,
    [messageTypes.SEND]: _handleSendResponse,
    [messageTypes.VERIFY]: _handleVerifyResponse,
  }[messageType])

// SignaldMessageType => number
const _timeoutFor = messageType =>
  ({
    [messageTypes.REGISTER]: 1000 * 30 * 1,
    [messageTypes.VERIFY]: 1000 * 30 * 1,
    [messageTypes.SEND]: 1000 * 120,
  }[messageType])

// (IncomingSignaldMessage | SendResponse) -> CallbackRoute
const handle = message => {
  const { callback, resolve, reject, state } = {
    [messageTypes.REGISTRATION_SUCCESS]:
      registry[`${messageTypes.REGISTER}-${get(message, 'data.username')}`],
    [messageTypes.REGISTRATION_SUCCESS_SIGNALD]:
      registry[`${messageTypes.REGISTER}-${get(message, 'data.username')}`],
    [messageTypes.REGISTRATION_ERROR]:
      registry[`${messageTypes.REGISTER}-${get(message, 'data.username')}`],
    [messageTypes.SEND_RESULTS]: registry[`${messageTypes.SEND}-${message.id}`],
    [messageTypes.VERIFICATION_SUCCESS]:
      registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`],
    [messageTypes.VERIFICATION_ERROR]:
      registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`],
  }[message.type] || { callback: util.noop }
  callback({ message, resolve, reject, state })
}

// CALLBACKS

const _handleRegisterResponse = ({ message, resolve, reject }) => {
  delete registry[`${messageTypes.REGISTER}-${get(message, 'data.username')}`]
  if (message.type === messageTypes.REGISTRATION_ERROR)
    reject(
      new Error(
        messages.registration.error(
          get(message, 'data.username', 'N/A'),
          get(message, 'data.message', 'N/A'),
        ),
      ),
    )
  if (message.type === messageTypes.REGISTRATION_SUCCESS)
    resolve({
      status: statuses.SUCCESS,
      message: get(message, 'data.username', 'N/A'),
    })
}

const _handleSendResponse = ({ message, state, resolve }) => {
  logger.log(`Handling send`)
  delete registry[`${messageTypes.SEND}-${message.id}`]
  const { whenSent } = state
  const elapsed = util.nowInMillis() - whenSent
  resolve(elapsed)
}

// (IncomingSignaldMessage, function, function) -> void
const _handleVerifyResponse = ({ message, resolve, reject }) => {
  delete registry[`${messageTypes.VERIFY}-${get(message, 'data.username')}`]
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
