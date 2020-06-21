const crypto = require('crypto')
const { wait } = require('../util')
const signal = require('../signal')
const {
  signal: { minResendInterval, maxResendInterval },
} = require('../../config')

// (Socket, ResendQueue, SdMessage) -> number?
// - impelements a queue for resending messages that are droped due to rate-limiting by signal
// - uses exponential backoff between resend attempts up to a `maxResendInterval` limit
// - returns the interval after which the message will be resent, or null if it will not be resent
const enqueueResend = (resendQueue, inSdMessage) => {
  const msgHash = hash(inSdMessage)
  const msgAlreadyResent = resendQueue[msgHash]

  // if message already resent, increase the resend interval by power of 2, else start with the min interval (2 sec)
  const newResendInterval = msgAlreadyResent
    ? resendQueue[msgHash].lastResendInterval * 2
    : minResendInterval

  // don't resend anymore if message has exceeded max resend threshold
  if (newResendInterval > maxResendInterval) {
    delete resendQueue[msgHash]
    return null
  }

  // okay! we're going to resend! let's...

  // format a proper outbound message
  const outSdMessage = signal.parseOutboundSdMessage(inSdMessage)
  // record the interval we are about to wait and the outbound-formatted sd message
  resendQueue[msgHash] = { sdMessage: outSdMessage, lastResendInterval: newResendInterval }
  // enqueue the message for resending after waiting the new interval
  _resendAfter(outSdMessage, newResendInterval)
  // end by returning the interval so we can report it to admins
  return newResendInterval
}

const _resendAfter = async (outSdMessage, resendInterval) => {
  await wait(resendInterval)
  signal.sendMessage(outSdMessage.recipientNumber, outSdMessage)
}

// SdMessage -> string
const hash = sdMessage => {
  // hashes an sd message into a 20-byte hex string, using sha1 algo
  const { messageBody, username, recipientNumber, attachments } = sdMessage
  return crypto
    .createHash('sha1')
    .update(messageBody + username + recipientNumber + attachments.map(getFileName).join(''))
    .digest('hex')
}

const getFileName = attachment => attachment.storedFilename || attachment.filename

module.exports = { enqueueResend, hash }
