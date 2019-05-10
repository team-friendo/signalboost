const net = require('net')
const { pick, get } = require('lodash')
const fs = require('fs-extra')
const { promisifyCallback, wait } = require('./util.js')
const {
  signal: { connectionInterval, maxConnectionAttempts, verificationTimeout },
} = require('../config/index')

/**
 * type InboundSignaldMessage = {
 *   type: "message",
 *   data: {
 *     username: string,
 *     source: string,
 *     dataMessage: ?{
 *       timestamp: number,
 *       message: string,
 *       expiresInSeconds: number,
 *       attachments: Array<InAttachment>,
 *     }
 *   }
 * }
 *
 * type InboundAttachment = {
 *   contentType: string,
 *   id: number,
 *   size: number,
 *   storedFilename: string,
 *   width: number,
 *   height: number,
 *   voiceNote: boolean,
 *   preview: { present: boolean },
 *   key: string, (base64)
 *   digest: string, (base64)
 * }
 *
 * type OutboundSignaldMessage = {
 *   type: "send",
 *   username: string,
 *   recipientNumber, ?string, (must include either recipientId or recipientGroupId)
 *   recipientGroupId: ?string,
 *   messageBody: string,
 *   attachments: Array<OutAttachment>,
 *   quote: ?QuoteObject, (ingoring)
 * }
 *
 * type OutboundAttachment = {
 *   filename: string (The filename of the attachment) == `storedFilename`
 *   caption: string (An optional caption) == ../../dataMessage.message
 *   width: int (The width of the image) == width
 *   height: int (The height of the image) == height
 *   voiceNote: bool (True if this attachment is a voice note) == voiceNote
 *   preview: string (The preview data to send, base64 encoded) == preview
 * }
 *
 * */

// CONSTANTS

const signaldSocketPath = '/var/run/signald/signald.sock'

const messageTypes = {
  ERROR: 'unexpected_error',
  MESSAGE: 'message',
  REGISTER: 'register',
  SEND: 'send',
  SUBSCRIBE: 'subscribe',
  VERIFY: 'verify',
  VERIFICATION_SUCCESS: 'verification_succeeded',
  VERIFICATION_ERROR: 'verification_error',
  VERIFICATION_REQUIRED: 'verification_required',
}

const errorMessages = {
  verificationFailure: (phoneNumber, reason) =>
    `Signal registration failed for ${phoneNumber}. Reason: ${reason}`,
  verificationTimeout: phoneNumber => `Verification for ${phoneNumber} timed out`,
}

/**************************
 * UNIX SOCKET MANAGEMENT
 **************************/

const getSocket = async (attempts = 0) => {
  if (!(await fs.pathExists(signaldSocketPath))) {
    if (attempts > maxConnectionAttempts) {
      return Promise.reject(new Error('maximum signald connection attempts exceeded. aborting.'))
    } else {
      return wait(connectionInterval).then(() => getSocket(attempts + 1))
    }
  } else {
    return connect()
  }
}

const connect = () => {
  try {
    const sock = net.createConnection(signaldSocketPath)
    sock.setEncoding('utf8')
    return new Promise(resolve => sock.on('connect', () => resolve(sock)))
  } catch (e) {
    return Promise.reject('failed to connect to signald socket')
  }
}

const write = (sock, data) =>
  new Promise((resolve, reject) =>
    sock.write(JSON.stringify(data) + '\n', promisifyCallback(resolve, reject)),
  )

/********************
 * SIGNALD COMMANDS
 ********************/

const register = (sock, phoneNumber) =>
  write(sock, { type: messageTypes.REGISTER, username: phoneNumber })

const verify = (sock, phoneNumber, code) =>
  write(sock, { type: messageTypes.VERIFY, username: phoneNumber, code })

const awaitVerificationResult = async (sock, phoneNumber) => {
  return new Promise((resolve, reject) => {
    sock.on('data', function handle(msg) {
      const { type, data } = JSON.parse(msg)
      if (isVerificationSuccess(type, data, phoneNumber)) {
        sock.removeListener('data', handle)
        resolve(data)
      } else if (isVerificationFailure(type, data, phoneNumber)) {
        sock.removeListener('data', handle)
        const reason = get(data, 'message', 'Captcha required: 402')
        reject(new Error(errorMessages.verificationFailure(phoneNumber, reason)))
      } else {
        // on first message (reporting registration) set timeout for listening to subsequent messages
        wait(verificationTimeout).then(() => {
          sock.removeListener('data', handle)
          reject(new Error(errorMessages.verificationTimeout(phoneNumber)))
        })
      }
    })
  })
}

const isVerificationSuccess = (type, data, phoneNumber) =>
  type === messageTypes.VERIFICATION_SUCCESS && get(data, 'username') === phoneNumber

const isVerificationFailure = (type, data, phoneNumber) =>
  type === messageTypes.ERROR && get(data, 'request.username') === phoneNumber

// (Socket, string) -> Promise<void>
const subscribe = (sock, phoneNumber) =>
  write(sock, { type: messageTypes.SUBSCRIBE, username: phoneNumber })

const sendMessage = (sock, recipientNumber, outboundMessage) =>
  write(sock, { ...outboundMessage, recipientNumber })

// (Socket, Array<string>, OutMessage) -> Promise<void>
const broadcastMessage = (sock, recipientNumbers, outboundMessage) =>
  Promise.all(
    recipientNumbers.map(recipientNumber => sendMessage(sock, recipientNumber, outboundMessage)),
  )

/*******************
 * MESSAGE PARSING
 *******************/

// InboundMessage -> OutboundMessage
const parseOutboundSdMessage = inboundSdMessage => {
  const {
    data: { username, dataMessage },
  } = inboundSdMessage
  return {
    type: messageTypes.SEND,
    username,
    recipientNumber: null,
    messageBody: dataMessage.message,
    attachments: dataMessage.attachments.map(parseOutboundAttachment),
  }
}

const parseOutboundAttachment = inAttachment => ({
  filename: inAttachment.storedFilename,
  ...pick(inAttachment, ['width', 'height', 'voiceNote']),
})

const parseVerificationCode = verificationMessage =>
  verificationMessage.match(/Your Signal verification code: (\d\d\d-\d\d\d)/)[1]

module.exports = {
  messageTypes,
  awaitVerificationResult,
  getSocket,
  subscribe,
  broadcastMessage,
  register,
  sendMessage,
  parseOutboundSdMessage,
  parseVerificationCode,
  verify,
}
