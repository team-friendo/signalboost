const { messageTypes } = require('../signal')

/**
 * type CallbackRoute = {
 *   socket: Socket,
 *   callback: (Socket, IncomingSignaldMessage) -> Promise<SignalboostStatus>
 * }
 *
 * type CallbackRegistry {
 *   [string]: CallbackRoute
 * }
 * **/

// CallbackRegistry
const registry = {}

// (Socket, OutgoingSignaldMessage) -> void
const register = (socket, outSdMsg) => {
  switch (outSdMsg.type) {
    case messageTypes.TRUST:
      registry[`${messageTypes.TRUST}-${outSdMsg.fingerprint}`] = {
        socket,
        callback: handleTrustResponse,
      }
  }
}

// IncomingSignaldMessage -> CallbackRoute
const route = inSdMsg => {
  switch (inSdMsg.type) {
    case messageTypes.TRUSTED_FINGERPRINT:
      return registry[`${messageTypes.TRUST}-${inSdMsg.data.request.fingerprint}`]
    default:
      return undefined
  }
}

// (Socket, IncomingSignaldMessage) -> Promise<SignaldStatus>
const handleTrustResponse = (socket, inSdMsg) => Promise.resolve({ status: 'SUCCESS', message: '' })

module.exports = { registry, register, route, handleTrustResponse }
