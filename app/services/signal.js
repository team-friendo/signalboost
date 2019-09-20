const net = require('net')
const fs = require('fs-extra')
const { pick, get, sortBy, last } = require('lodash')
const { promisifyCallback, wait } = require('./util.js')
const { statuses } = require('../constants')
const {
  signal: {
    connectionInterval,
    maxConnectionAttempts,
    verificationTimeout,
    identityRequestTimeout,
  },
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
 * type SignalIdentity -= {
 *   trust_level: "TRUSTED" | "TRUSTED_UNVERIFIED" | "UNTRUSTED"
 *   added: string, // millis from epoc
 *   fingerprint: string // 32 space-separated 32 hex octets
 *   safety_number: string, // 60 digit number
 *   username: string, // valid phone number
 * }
 *
 * */

// CONSTANTS

const signaldSocketPath = '/var/run/signald/signald.sock'

const messageTypes = {
  GET_IDENTITIES: 'get_identities',
  ERROR: 'unexpected_error',
  IDENTITIES: 'identities',
  MESSAGE: 'message',
  REGISTER: 'register',
  SEND: 'send',
  SUBSCRIBE: 'subscribe',
  TRUST: 'trust',
  VERIFY: 'verify',
  VERIFICATION_SUCCESS: 'verification_succeeded',
  VERIFICATION_ERROR: 'verification_error',
  VERIFICATION_REQUIRED: 'verification_required',
}

const trustLevels = {
  TRUSTED_VERIFIED: 'TRUSTED_VERIFIED',
  TRUSTED_UNVERIFIED: 'TRUSTED_UNVERIFIED',
  UNTRUSTED: 'UNTRUSTED',
}

// TODO(aguestuser|2019-09-20): localize these...
const errorMessages = {
  socketTimeout: 'Maximum signald connection attempts exceeded.',
  socketConnectError: reason => `Failed to connect to signald socket; Reason: ${reason}`,
  trustError: phoneNumber => `Failed to trust new safety number for ${phoneNumber}`,
  verificationFailure: (phoneNumber, reason) =>
    `Signal registration failed for ${phoneNumber}. Reason: ${reason}`,
  verificationTimeout: phoneNumber => `Verification for ${phoneNumber} timed out`,
  identityRequestTimeout: phoneNumber => `Request for identities of ${phoneNumber} timed out`,
}

// TODO(aguestuser|2019-08-20): alo localize these...
const successMessages = {
  trustSuccess: phoneNumber => `Trusted new safety number for ${phoneNumber}.`,
}

/**************************
 * UNIX SOCKET MANAGEMENT
 **************************/

const getSocket = async (attempts = 0) => {
  if (!(await fs.pathExists(signaldSocketPath))) {
    if (attempts > maxConnectionAttempts) {
      return Promise.reject(new Error(errorMessages.socketTimeout))
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
    sock.setMaxListeners(0) // removes ceiling on number of listeners (useful for `await` handlers below)
    return new Promise(resolve => sock.on('connect', () => resolve(sock)))
  } catch (e) {
    return Promise.reject(new Error(errorMessages.socketConnectError(e.message)))
  }
}

const write = (sock, data) =>
  new Promise((resolve, reject) =>
    sock.write(signaldEncode(data), promisifyCallback(resolve, reject)),
  )

const signaldEncode = data => JSON.stringify(data) + '\n'

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

// (Socket, String, String) -> Promise<Array<TrustResult>>
const trust = async (sock, channelPhoneNumber, pubSubPhoneNumber) => {
  const { fingerprint } = await fetchMostRecentId(sock, channelPhoneNumber, pubSubPhoneNumber)
  write(sock, {
    type: messageTypes.TRUST,
    username: channelPhoneNumber,
    recipientNumber: pubSubPhoneNumber,
    fingerprint,
  })
  return awaitTrustVerification(sock, channelPhoneNumber, pubSubPhoneNumber)
}

// (Socket, string, string) => Promise<TrustResult>
const awaitTrustVerification = async (sock, channelPhoneNumber, pubSubPhoneNumber) => {
  const id = await fetchMostRecentId(sock, channelPhoneNumber, pubSubPhoneNumber)
  return id.trust_level === trustLevels.TRUSTED_VERIFIED
    ? Promise.resolve({
        status: statuses.SUCCESS,
        message: successMessages.trustSuccess(pubSubPhoneNumber),
      })
    : Promise.reject({
        status: statuses.ERROR,
        message: errorMessages.trustError(pubSubPhoneNumber),
      })
}

const fetchMostRecentId = async (sock, channelPhoneNumber, pubSubPhoneNumber) => {
  const ids = await fetchIdentities(sock, channelPhoneNumber, pubSubPhoneNumber)
  return last(sortBy(ids, 'added'))
}

// (Socket, String, String) -> Promise<Array<SignalIdentity>>
const fetchIdentities = (sock, channelPhoneNumber, pubSubPhoneNumber) => {
  write(sock, {
    type: messageTypes.GET_IDENTITIES,
    username: channelPhoneNumber,
    recipientNumber: pubSubPhoneNumber,
  })
  return awaitIdentitiesOf(sock, pubSubPhoneNumber)
}

const awaitIdentitiesOf = (sock, pubSubPhoneNumber) => {
  return new Promise((resolve, reject) => {
    // create handler
    const handle = msg => {
      const { type, data } = JSON.parse(msg)
      if (isSignalIdentitiesOf(type, data, pubSubPhoneNumber)) {
        sock.removeListener('data', handle)
        resolve(data.identities)
      }
    }
    // register handler
    sock.on('data', handle)
    // reject and deregister handle after timeout
    wait(identityRequestTimeout).then(() => {
      sock.removeListener('data', handle)
      reject({
        status: statuses.ERROR,
        message: errorMessages.identityRequestTimeout(pubSubPhoneNumber),
      })
    })
  })
}

const isSignalIdentitiesOf = (msgType, msgData, pubSubPhoneNumber) =>
  msgType === messageTypes.IDENTITIES && get(msgData, 'identities.0.username') === pubSubPhoneNumber

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
  errorMessages,
  successMessages,
  trustLevels,
  awaitVerificationResult,
  broadcastMessage,
  fetchIdentities,
  signaldEncode,
  getSocket,
  parseOutboundSdMessage,
  parseVerificationCode,
  register,
  sendMessage,
  subscribe,
  trust,
  verify,
}
