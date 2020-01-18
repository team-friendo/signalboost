const crypto = require('crypto')
const { wait } = require('../util')
const signal = require('../signal')
const {
  signal: { minResendInterval, maxResendInterval },
} = require('../../config')

// (Socket, ResendQueue, SdMessage) -> void
const enqueueResend = async (sock, resendQueue, sdMessage) => {
  // impelements a queue for resending messages that are not sent due to rate-limit errors
  // with exponential backoff between resend attempts up to a `maxResendInterval` limit
  const msgHash = hash(sdMessage)

  // if message has already been resent, pick the new resend interval
  // by multiplying the last resend interval by 2
  const newResendInterval = resendQueue[msgHash]
    ? resendQueue[msgHash].lastResendInterval * 2
    : minResendInterval

  // don't resend anymore if message has exceeded max resend threshold
  if (newResendInterval > maxResendInterval) {
    delete resendQueue[msgHash]
    return
  }

  // TODO: notify admins that a message is being enqueed for resending...

  // after waiting the new interval, send message and record interval we just waited
  // (we record the interval just before sending to ensure the queue is in a correct state
  //  in the case that the resend fails almost instantaneously)
  await wait(newResendInterval)
  resendQueue[msgHash] = { sdMessage, lastResendInterval: newResendInterval }
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
