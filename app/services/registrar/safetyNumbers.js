const signal = require('../../services/signal')
const { wait, loggerOf } = require('../util')
const logger = loggerOf('safetyNumberService')
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

// (Database, Socket, string, string, SdMessage) -> Promise<TrustTally>
const trustAndResend = async (db, sock, channelPhoneNumber, memberPhoneNumber, sdMessage) => {
  try {
    const trustResult = await signal.trust(sock, channelPhoneNumber, memberPhoneNumber)
    await wait(resendDelay) // to avoid signal rate limiting block
    await signal.sendMessage(sock, memberPhoneNumber, sdMessage)

    logger.log(trustResult.message)
    return Promise.resolve(trustResult)
  } catch (e) {
    logger.error(e.message)
    return Promise.reject(e)
  }
}

module.exports = { trustAndResend, logger }
