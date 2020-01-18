const crypto = require('crypto');

const hash = sdMessage => {
  // hashes an sd message into a 20-byte hex string, using sha1 algo
  const { messageBody, username, recipientNumber, attachments } = sdMessage
  return crypto
    .createHash('sha1')
    .update(messageBody + username + recipientNumber + attachments.join(''))
    .digest('hex')
}

module.exports = { hash }