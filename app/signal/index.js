const socketWriter = require('../socket/write')
const channelRepository = require('../db/repositories/channel')
const callbacks = require('./callbacks')
const { pick, isEmpty } = require('lodash')
const { defaultExpiryTime, messages, messageTypes, trustLevels } = require('./constants')
const util = require('../util')
const { statuses, loggerOf } = util
const {
  signal: { diagnosticsPhoneNumber },
} = require('../config')

/**
 *
 * type Address = {
 *   number: ?string,
 *   uuid: ?string,
 * }
 *
 * type InboundSignaldMessage = {
 *   type: "message",
 *   data: {
 *     username: string,
 *     source: Address,
 *     sourceDevice: number,
 *     type: string,
 *     dataMessage: ?{
 *       timestamp: number,
 *       body: string,
 *       expiresInSeconds: number,
 *       endSession: bool,
 *       profileKeyUpdate: bool,
 *       attachments: Array<InAttachment>?,
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
 *   recipientAddress, ?Address, (must include either recipientId or recipientGroupId)
 *   messageBody: string,
 *   attachments: Array<InAttachment>,
 *   quote: ?QuoteObject, (ingoring)
 * }
 *
 * type OutboundSignaldMessage = {
 *   type: "send",
 *   username: string,
 *   recipientAddress, ?Address, (must include either recipientId or recipientGroupId)
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

const run = async () => {
  logger.log(`--- Subscribing to channels...`)
  const channels = await channelRepository.findAll().catch(logger.fatalError)
  const numListening = await Promise.all(
    channels.map(({ phoneNumber, socketId }) => subscribe(phoneNumber, socketId)),
  )
  logger.log(`--- Subscribed to ${numListening.length} / ${channels.length} channels!`)
}

/******************
 * HEALTHCHECK
 ******************/

// string -> Promise<number>
const healthcheck = async (channelPhoneNumber, socketId) => {
  // - sends a message from the diagnostics channel to a user channel to see if the user channel is alive.
  //   message is in the form: `healthcheck <uuid>`
  // - the user channel signals aliveness in `dispatcher.command.execute` by echoing
  //   the message back to the diagnostics channel and including the healtcheck uuid as the
  //   id field of the command response. this allows the response to be identified by the
  //   callback handlers in `signal.callbacks` and passed to `_handleHealtcheckResposne`
  // - this function itself resolves a promise with either:
  //   (1) the response time (in seconds) of the healthcheck
  ///  (2) -1 if the the healthcheck timed out
  const id = util.genUuid()
  socketWriter.write(
    {
      type: messageTypes.SEND,
      username: diagnosticsPhoneNumber,
      messageBody: `${messageTypes.HEALTHCHECK} ${id}`,
      recipientAddress: { number: channelPhoneNumber },
      expiresInSeconds: defaultExpiryTime,
    },
    socketId,
  )
  return new Promise((resolve, reject) =>
    callbacks.register({
      messageType: messageTypes.HEALTHCHECK,
      id,
      resolve,
      reject,
      state: { whenSent: util.nowInMillis() },
    }),
  ).catch(() => -1) // represent a time-out as a negative response time
}

/********************
 * SIGNALD COMMANDS
 ********************/

// string => Promise<string>
const abort = socketId =>
  // sends a poison pill to signald, causing it to shut down
  socketWriter.write({ type: messageTypes.ABORT }, socketId)

// string => Promise<string>
const isAlive = socketId => {
  // checks to see if signald is a live by asking for version.
  // resolves with version or rejects with error.
  socketWriter.write({ type: messageTypes.VERSION }, socketId)
  return new Promise((resolve, reject) =>
    callbacks.register({
      id: socketId,
      messageType: messageTypes.VERSION,
      resolve,
      reject,
    }),
  )
}

// (string, string || null) -> Promise<SignalboostStatus>
const register = async (phoneNumber, captchaToken) => {
  socketWriter.write(
    {
      type: messageTypes.REGISTER,
      username: phoneNumber,
      ...(captchaToken ? { captcha: captchaToken } : {}),
    },
    0,
  )
  // Since a registration isn't meaningful without a verification code,
  // we resolve `register` by invoking the callback handler fo the response to the VERIFY request
  // that will be issued to signald after twilio callback (POST /twilioSms) triggers `verify` below
  return new Promise((resolve, reject) =>
    callbacks.register({
      messageType: messageTypes.VERIFY,
      id: phoneNumber,
      resolve,
      reject,
    }),
  )
}

// (string, string) -> Promise<SignalboostStatus>
const verify = (phoneNumber, code) =>
  // This function is only called from twilio callback as fire-and-forget.
  // Its response will be picked up by the callback for the REGISTER command that triggered it.
  // Therefore, all we need to do with this response is signal to twilio whether socketWriter socketWriter.write worked.
  socketWriter
    .write({ type: messageTypes.VERIFY, username: phoneNumber, code }, 0)
    .then(() => ({ status: statuses.SUCCESS, message: 'OK' }))
    .catch(e => ({ status: statuses.ERROR, message: e.message }))

// (string, number) -> Promise<string>
const subscribe = (phoneNumber, socketId) =>
  socketWriter.write({ type: messageTypes.SUBSCRIBE, username: phoneNumber }, socketId)

// (string, number) -> Promise<string>
const unsubscribe = (phoneNumber, socketId) =>
  socketWriter.write({ type: messageTypes.UNSUBSCRIBE, username: phoneNumber }, socketId)

// (OutboundSignaldMessage, number) -> Promise<string>
const sendMessage = async (sdMessage, socketId) => {
  const id = await socketWriter.write(sdMessage, socketId)
  callbacks.register({
    id,
    messageType: messageTypes.SEND,
    state: {
      channelPhoneNumber: sdMessage.username,
      messageBody: sdMessage.messageBody,
      attachments: sdMessage.attachments,
      whenSent: util.nowInMillis(),
    },
  })
  return id
}

const setExpiration = async (channelPhoneNumber, memberPhoneNumber, expiresInSeconds, socketId) => {
  const id = await socketWriter.write(
    {
      type: messageTypes.SET_EXPIRATION,
      username: channelPhoneNumber,
      recipientAddress: { number: memberPhoneNumber },
      expiresInSeconds,
    },
    socketId,
  )
  return id
}

// (String, String, String, number) -> Promise<SignalboostStatus>
const trust = async (channelPhoneNumber, memberPhoneNumber, fingerprint, socketId) => {
  const id = await socketWriter.write(
    {
      type: messageTypes.TRUST,
      username: channelPhoneNumber,
      recipientAddress: { number: memberPhoneNumber },
      fingerprint,
    },
    socketId,
  )
  return new Promise((resolve, reject) => {
    callbacks.register({ messageType: messageTypes.TRUST, id, resolve, reject })
  })
}

/*******************
 * MESSAGE PARSING
 *******************/

// InboundMessage|ResendRequest -> OutboundMessage
const parseOutboundSdMessage = inboundSdMessage => {
  // handles both (1) inbound messages (of type "message") and (2) outbound messages (of type "send")
  // - for (1) it will flip the recipient "username" field into a sender "username" field, ignore the
  //   sourceAddress field, and set `recipientAddress` to undefined (b/c it was absent in inbound msg)
  // - for (2) it will maintain cardinality of sender/recipient, and restore recipientAddress to orginal value
  const {
    recipientAddress,
    data: { username, dataMessage },
  } = transformToInboundMessage(inboundSdMessage)
  return {
    type: messageTypes.SEND,
    username,
    recipientAddress,
    messageBody: dataMessage.body || '',
    attachments: (dataMessage.attachments || []).map(parseOutboundAttachment),
  }
}

// InboundMessage|ResendRequest -> InboundMessage
const transformToInboundMessage = message => {
  const { type } = message
  if (type === 'message') {
    return message
  } else {
    return {
      recipientAddress: message.recipientAddress,
      data: {
        username: message.username,
        dataMessage: { body: message.messageBody, attachments: message.attachments },
      },
    }
  }
}

// SignaldInboundAttachment -> SignaldOutboundAttachment
const parseOutboundAttachment = inAttachment => ({
  filename: inAttachment.storedFilename || inAttachment.filename || '',
  ...pick(inAttachment, [
    'blurHash',
    'caption',
    'contentType',
    'digest',
    'filename',
    'height',
    'id',
    'key',
    'size',
    'width',
    'voiceNote',
  ]),
})

// string -> [boolean, string]
const parseVerificationCode = verificationMessage => {
  const matches = verificationMessage.match(/.*: (\d\d\d-\d\d\d)/)
  return isEmpty(matches) ? [false, verificationMessage] : [true, matches[1]]
}

module.exports = {
  messages,
  messageTypes,
  trustLevels,
  abort,
  healthcheck,
  isAlive,
  parseOutboundSdMessage,
  parseOutboundAttachment,
  parseVerificationCode,
  register,
  run,
  sendMessage,
  subscribe,
  trust,
  verify,
  setExpiration,
  unsubscribe,
}
