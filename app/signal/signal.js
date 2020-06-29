const app = require('../index')
const callbacks = require('./callbacks')
const { pick, get, isEmpty } = require('lodash')
const { statuses } = require('../util')
const channelRepository = require('../db/repositories/channel')
const { wait, loggerOf } = require('../util.js')
const { messages, messageTypes, trustLevels } = require('./constants')
const {
  signal: { signaldRequestTimeout },
} = require('../config')

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
 * type ResendRequest = {
 *   type: "send",
 *   username: string,
 *   recipientNumber, ?string, (must include either recipientId or recipientGroupId)
 *   recipientGroupId: ?string,
 *   messageBody: string,
 *   attachments: Array<InAttachment>,
 *   quote: ?QuoteObject, (ingoring)
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
 * type SignalIdentity -= {
 *   trust_level: "TRUSTED" | "TRUSTED_UNVERIFIED" | "UNTRUSTED"
 *   added: string, // millis from epoc
 *   fingerprint: string // 32 space-separated 32 hex octets
 *   safety_number: string, // 60 digit number
 *   username: string, // valid phone number
 * }
 *
 * */

const logger = loggerOf('signal')

/**********************
 * STARTUP
 **********************/

let socket
const run = async () => {
  logger.log(`--- Subscribing to channels...`)
  // we import socket here due to import-time weirdness imposed by app.run
  socket = require('../socket')
  const channels = await channelRepository.findAllDeep().catch(logger.fatalError)
  const numListening = await Promise.all(channels.map(ch => subscribe(ch.phoneNumber)))
  logger.log(`--- Subscribed to ${numListening.length} / ${channels.length} channels!`)
}

/********************
 * SIGNALD COMMANDS
 ********************/

// string -> Promise<void>
const register = async phoneNumber => {
  socket.write({ type: messageTypes.REGISTER, username: phoneNumber })
  return new Promise((resolve, reject) =>
    callbacks.register(messageTypes.REGISTER, phoneNumber, resolve, reject),
  )
}

// (string, string) -> Promise<void>
const verify = (phoneNumber, code) =>
  // This function is only called from twilio callback as fire-and-forget.
  // Its response will be picked up by the callback for the REGISTER command that triggered it.
  // Therefore, all we need to do with this response is signal to twilio whether socket write worked.
  socket
    .write({ type: messageTypes.VERIFY, username: phoneNumber, code })
    .then(() => ({ status: statuses.SUCCESS, message: 'OK' }))
    .catch(e => ({ status: statuses.ERROR, message: e.message }))

// string -> Promise<void>
const subscribe = phoneNumber =>
  socket.write({ type: messageTypes.SUBSCRIBE, username: phoneNumber })

// string -> Promise<void>
const unsubscribe = phoneNumber =>
  socket.write({ type: messageTypes.UNSUBSCRIBE, username: phoneNumber })

// (string, string) -> Promise<void>
const sendMessage = (recipientNumber, outboundMessage) =>
  socket.write({ ...outboundMessage, recipientNumber })

// (Socket, Array<string>, OutMessage) -> Promise<void>
const broadcastMessage = (recipientNumbers, outboundMessage) =>
  Promise.all(
    recipientNumbers.map(recipientNumber => sendMessage(recipientNumber, outboundMessage)),
  )

const setExpiration = (channelPhoneNumber, memberPhoneNumber, expiresInSeconds) =>
  socket.write({
    type: messageTypes.SET_EXPIRATION,
    username: channelPhoneNumber,
    recipientNumber: memberPhoneNumber,
    expiresInSeconds,
  })

// (String, String, String?) -> Promise<SignalboostStatus>
const trust = async (channelPhoneNumber, memberPhoneNumber, fingerprint) => {
  socket.write({
    type: messageTypes.TRUST,
    username: channelPhoneNumber,
    recipientNumber: memberPhoneNumber,
    fingerprint,
  })
  return new Promise((resolve, reject) => {
    callbacks.register(messageTypes.TRUST, fingerprint, resolve, reject)
  })
}

const isAlive = () => {
  socket.write({ type: messageTypes.VERSION })
  return awaitVersion()
}

const awaitVersion = () =>
  new Promise((resolve, reject) => {
    const handle = msg => {
      const { type, data } = safeJsonParse(msg, reject)
      if (type === null && data === null) {
        return Promise.resolve()
      } else if (type === messageTypes.VERSION) {
        app.sock.removeListener('data', handle)
        resolve({
          status: statuses.SUCCESS,
        })
      }
    }
    // register handler
    app.sock.on('data', handle)
    // reject and deregister handle after timeout if no trust response received
    wait(signaldRequestTimeout).then(() => {
      app.sock.removeListener('data', handle)
      reject({
        status: statuses.ERROR,
      })
    })
  })

/*******************
 * MESSAGE PARSING
 *******************/

// (Any) -> { type: string, data: object }
const safeJsonParse = msg => {
  try {
    return JSON.parse(msg)
  } catch (e) {
    return { type: null, data: null }
  }
}

// InboundMessage|ResendRequest -> OutboundMessage
const parseOutboundSdMessage = inboundSdMessage => {
  const {
    recipientNumber,
    data: { username, dataMessage },
  } = transformToInboundMessage(inboundSdMessage)
  return {
    type: messageTypes.SEND,
    username,
    recipientNumber,
    messageBody: dataMessage.message,
    attachments: dataMessage.attachments.map(parseOutboundAttachment),
  }
}

// InboundMessage|ResendRequest -> InboundMessage
const transformToInboundMessage = message => {
  const { type } = message
  if (type === 'message') {
    return message
  } else {
    return {
      recipientNumber: message.recipientNumber,
      data: {
        username: message.username,
        dataMessage: { message: message.messageBody, attachments: message.attachments },
      },
    }
  }
}

const parseOutboundAttachment = inAttachment => ({
  filename: inAttachment.storedFilename || inAttachment.filename || '',
  ...pick(inAttachment, ['width', 'height', 'voiceNote']),
})

// string -> [boolean, string]
const parseVerificationCode = verificationMessage => {
  const matches = verificationMessage.match(/Your Signal verification code: (\d\d\d-\d\d\d)/)
  return isEmpty(matches) ? [false, verificationMessage] : [true, matches[1]]
}

const sdMessageOf = (channel, messageBody) => ({
  type: messageTypes.SEND,
  username: channel.phoneNumber,
  messageBody,
})

module.exports = {
  messages,
  messageTypes,
  trustLevels,
  broadcastMessage,
  isAlive,
  parseOutboundSdMessage,
  parseOutboundAttachment,
  parseVerificationCode,
  register,
  run,
  sendMessage,
  sdMessageOf,
  subscribe,
  trust,
  verify,
  setExpiration,
  unsubscribe,
}
