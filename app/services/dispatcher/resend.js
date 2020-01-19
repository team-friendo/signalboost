const crypto = require('crypto')
const { wait } = require('../util')
const signal = require('../signal')
const {
  signal: { minResendInterval, maxResendInterval },
} = require('../../config')

// (Socket, ResendQueue, SdMessage) -> number?
const enqueueResend = (sock, resendQueue, sdMessage) => {
  // - impelements a queue for resending messages that are droped due to rate-limiting by signal
  // - uses exponential backoff between resend attempts up to a `maxResendInterval` limit
  // - returns the interval after which the message will be resent, or null if it will not be resent
  const msgHash = hash(sdMessage)

  // if message already resent, increase the resend interval by power of 2
  const newResendInterval = resendQueue[msgHash]
    ? resendQueue[msgHash].lastResendInterval * 2
    : minResendInterval

  // don't resend anymore if message has exceeded max resend threshold
  if (newResendInterval > maxResendInterval) {
    delete resendQueue[msgHash]
    return null
  }
  // okay! we're going to resend! let's...
  // record the interval we are about to wait
  resendQueue[msgHash] = { sdMessage, lastResendInterval: newResendInterval }
  // enqueue the message for resending after waiting the new interval
  _resendAfter(sock, sdMessage, newResendInterval)
  // end by returning the interval we are about to wait
  return newResendInterval
}

const _resendAfter = async (sock, sdMessage, resendInterval) => {
  await wait(resendInterval)
  signal.sendMessage(sock, sdMessage.recipientNumber, sdMessage)
}

// SdMessage -> string
const hash = sdMessage => {
  // hashes an sd message into a 20-byte hex string, using sha1 algo
  const { messageBody, username, recipientNumber, attachments } = sdMessage
  return crypto
    .createHash('sha1')
    .update(messageBody + username + recipientNumber + attachments.join(''))
    .digest('hex')
}

module.exports = { enqueueResend, hash }
