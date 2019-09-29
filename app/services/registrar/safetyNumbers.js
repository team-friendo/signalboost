const signal = require('../../services/signal')
const channelRepository = require('../../db/repositories/channel')
const { wait, loggerOf } = require('../util')
const logger = loggerOf('safetyNumberService')
const { messagesIn } = require('../dispatcher/messages')
const { defaultErrorOf } = require('../util')
const { sdMessageOf } = require('../signal')
const {
  signal: { resendDelay },
} = require('../../config')

/*******************************************************
 * type TrustResponse =
 *   status: "SUCCESS" | "ERROR"
 *   message: string,
 * }
 *
 ******************************************************/

// (Database, Socket, string, string, SdMessage) -> Promise<SignalboostStatus>
const trustAndResend = async (db, sock, channelPhoneNumber, memberPhoneNumber, sdMessage) => {
  const trustResult = await signal.trust(sock, channelPhoneNumber, memberPhoneNumber)
  await wait(resendDelay) // to avoid signal rate limiting block
  await signal.sendMessage(sock, memberPhoneNumber, sdMessage)
  return trustResult
}

// (Database, socket, string, string) -> Promise<SignalBoostStatus>
const deauthorize = async (db, sock, channelPhoneNumber, numberToDeauthorize) => {
  const removalResult = await channelRepository
    .removePublisher(db, channelPhoneNumber, numberToDeauthorize)
    .catch(e => Promise.reject(defaultErrorOf(e)))
  const { publications } = await channelRepository
    .findDeep(db, channelPhoneNumber)
    .catch(e => Promise.reject(defaultErrorOf(e)))
  await _sendDeauthAlerts(sock, channelPhoneNumber, numberToDeauthorize, publications)
  return removalResult
}

const _sendDeauthAlerts = (sock, channelPhoneNumber, deauthorizedNumber, publications) =>
  Promise.all(
    publications.map(({ publisherPhoneNumber, language }) =>
      signal.sendMessage(
        sock,
        publisherPhoneNumber,
        sdMessageOf(
          { phoneNumber: channelPhoneNumber },
          messagesIn(language).notifications.deauthorization(deauthorizedNumber),
        ),
      ),
    ),
  )

module.exports = { trustAndResend, deauthorize, logger }
