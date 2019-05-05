const net = require('net')
const { pick } = require('lodash')
const fs = require('fs-extra')
const { promisifyCallback, wait } = require('./util.js')
const logger = require('./dispatcher/logger')
const {
  signal: { connectionInterval, maxConnectionAttempts },
} = require('../config/index')

/*
 * type InboundSignaldMessage = {
 *   type: "message",
 *   data: {
 *     username: string,
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
  MESSAGE: 'message',
  REGISTER: 'register',
  SEND: 'send',
  SUBSCRIBE: 'subscribe',
  VERIFY: 'verify',
}

// UNIX SOCKET FUNCTIONS

const getSocket = async (attempts = 0) => {
  logger.log(`connecting to signald...`)
  if (!(await fs.pathExists(signaldSocketPath))) {
    if (attempts > maxConnectionAttempts) {
      logger.log('maximum signald connection attempts exceeded. aborting.')
      process.exit(1)
    } else {
      return wait(connectionInterval).then(() => getSocket(attempts + 1))
    }
  } else {
    logger.log(`connected to signald!`)
    return net.createConnection(signaldSocketPath)
  }
}

const write = (sock, data) =>
  new Promise((resolve, reject) =>
    sock.write(JSON.stringify(data) + '\n', promisifyCallback(resolve, reject)),
  )

// SIGNALD COMMANDS

const register = (sock, channelPhoneNumber) =>
  write(sock, { type: messageTypes.REGISTER, username: channelPhoneNumber })

const verify = (sock, channelPhoneNumber, code) =>
  write(sock, { type: messageTypes.VERIFY, username: channelPhoneNumber, code })

// (Socket, string) -> Promise<void>
const subscribe = (sock, channelPhoneNumber) =>
  write(sock, { type: messageTypes.SUBSCRIBE, username: channelPhoneNumber })

const sendMessage = (sock, recipientNumber, outboundMessage) =>
  write(sock, { ...outboundMessage, recipientNumber })

// (Socket, Array<string>, OutMessage) -> Promise<void>
const broadcastMessage = (sock, recipientNumbers, outboundMessage) =>
  Promise.all(
    recipientNumbers.map(recipientNumber => sendMessage(sock, recipientNumber, outboundMessage)),
  )

// MESSAGE PARSING

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

module.exports = {
  messageTypes,
  getSocket,
  subscribe,
  broadcastMessage,
  register,
  sendMessage,
  parseOutboundSdMessage,
  verify,
}
