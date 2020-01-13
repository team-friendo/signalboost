const net = require('net')
const fs = require('fs-extra')
const { pick, get } = require('lodash')
const { promisifyCallback, wait } = require('./util.js')
const { statuses } = require('../constants')
const { isEmpty } = require('lodash')
const {
  signal: { connectionInterval, maxConnectionAttempts, verificationTimeout, trustRequestTimeout },
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
  ERROR: 'unexpected_error',
  GET_IDENTITIES: 'get_identities',
  IDENTITIES: 'identities',
  MESSAGE: 'message',
  REGISTER: 'register',
  SEND: 'send',
  SET_EXPIRATION: 'set_expiration',
  SUBSCRIBE: 'subscribe',
  TRUST: 'trust',
  TRUSTED_FINGERPRINT: 'trusted_fingerprint',
  UNTRUSTED_IDENTITY: 'untrusted_identity',
  UNREADABLE_MESSAGE: 'unreadable_message',
  VERIFICATION_ERROR: 'verification_error',
  VERIFICATION_REQUIRED: 'verification_required',
  VERIFICATION_SUCCESS: 'verification_succeeded',
  VERIFY: 'verify',
}

const trustLevels = {
  TRUSTED_VERIFIED: 'TRUSTED_VERIFIED',
  TRUSTED_UNVERIFIED: 'TRUSTED_UNVERIFIED',
  UNTRUSTED: 'UNTRUSTED',
}

// TODO(aguestuser|2019-09-20): localize these...
const messages = {
  error: {
    socketTimeout: 'Maximum signald connection attempts exceeded.',
    invalidJSON: msg => `Failed to parse JSON: ${msg}`,
    socketConnectError: reason => `Failed to connect to signald socket; Reason: ${reason}`,
    verificationFailure: (phoneNumber, reason) =>
      `Signal registration failed for ${phoneNumber}. Reason: ${reason}`,
    verificationTimeout: phoneNumber => `Verification for ${phoneNumber} timed out`,
    trustTimeout: (channelPhoneNumber, memberPhoneNumber) =>
      `Trust command for member ${memberPhoneNumber} on channel ${channelPhoneNumber} timed out.`,
    identityRequestTimeout: phoneNumber => `Request for identities of ${phoneNumber} timed out`,
  },
  trust: {
    error: (channelPhoneNumber, memberPhoneNumber, msg) =>
      `Failed to trust new safety number for ${memberPhoneNumber} on channel ${channelPhoneNumber}: ${msg}`,
    success: (channelPhoneNumber, memberPhoneNumber) =>
      `Trusted new safety number for ${memberPhoneNumber} on channel ${channelPhoneNumber}.`,
    noop: phoneNumber => `${phoneNumber} has no new safety numbers to trust`,
  },
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
      return Promise.reject(new Error(messages.error.socketTimeout))
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
    return Promise.reject(new Error(messages.error.socketConnectError(e.message)))
  }
}

const write = (sock, data) =>
  new Promise((resolve, reject) =>
    sock.write(
      signaldEncode(data),
      promisifyCallback(resolve, e =>
        reject({
          status: statuses.ERROR,
          message: `Error writing to signald socket: ${e.message}`,
        }),
      ),
    ),
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
  //TODO(aguestuser|2019-11-09): use signald message ids to make this await call simpler
  return new Promise((resolve, reject) => {
    sock.on('data', function handle(msg) {
      const { type, data } = safeJsonParse(msg, reject)
      if (type === null && data === null) {
        reject(new Error(messages.error.invalidJSON(msg)))
      } else if (_isVerificationFailure(type, data, phoneNumber)) {
        sock.removeListener('data', handle)
        const reason = get(data, 'message', 'Captcha required: 402')
        reject(new Error(messages.error.verificationFailure(phoneNumber, reason)))
      } else if (_isVerificationSuccess(type, data, phoneNumber)) {
        sock.removeListener('data', handle)
        resolve(data)
      } else if (_isVerificationFailure(type, data, phoneNumber)) {
        sock.removeListener('data', handle)
        const reason = get(data, 'message', 'Captcha required: 402')
        reject(new Error(messages.error.verificationFailure(phoneNumber, reason)))
      } else {
        // on first message (reporting registration) set timeout for listening to subsequent messages
        wait(verificationTimeout).then(() => {
          sock.removeListener('data', handle)
          reject(new Error(messages.error.verificationTimeout(phoneNumber)))
        })
      }
    })
  })
}

const _isVerificationSuccess = (type, data, phoneNumber) =>
  type === messageTypes.VERIFICATION_SUCCESS && get(data, 'username') === phoneNumber

const _isVerificationFailure = (type, data, phoneNumber) =>
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

const setExpiration = (sock, channelPhoneNumber, memberPhoneNumber, expiresInSeconds) =>
  write(sock, {
    type: messageTypes.SET_EXPIRATION,
    username: channelPhoneNumber,
    recipientNumber: memberPhoneNumber,
    expiresInSeconds,
  })

// (Socket, String, String, String?) -> Promise<Array<TrustResult>>
const trust = async (sock, channelPhoneNumber, memberPhoneNumber, fingerprint) => {
  // don't await this write so we can start listening sooner!
  write(sock, {
    type: messageTypes.TRUST,
    username: channelPhoneNumber,
    recipientNumber: memberPhoneNumber,
    fingerprint,
  })
  return await _awaitTrustVerification(sock, channelPhoneNumber, memberPhoneNumber, fingerprint)
}

// (Socket, string, string) => Promise<TrustResult>
const _awaitTrustVerification = async (
  sock,
  channelPhoneNumber,
  memberPhoneNumber,
  fingerprint,
) => {
  return new Promise((resolve, reject) => {
    // create handler
    const handle = msg => {
      const { type, data } = safeJsonParse(msg, reject)
      if (type === null && data === null) {
        // ignore bad JSON
        return Promise.resolve()
      } else if (
        type === messageTypes.TRUSTED_FINGERPRINT &&
        data.request.fingerprint === fingerprint
      ) {
        // return success if we get a trust response
        sock.removeListener('data', handle)
        resolve({
          status: statuses.SUCCESS,
          message: messages.trust.success(channelPhoneNumber, memberPhoneNumber),
        })
      }
    }
    // register handler
    sock.on('data', handle)
    // reject and deregister handle after timeout if no trust response received
    wait(trustRequestTimeout).then(() => {
      sock.removeListener('data', handle)
      reject({
        status: statuses.ERROR,
        message: messages.error.trustTimeout(channelPhoneNumber, memberPhoneNumber),
      })
    })
  })
}

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
  messageTypes,
  messages,
  successMessages,
  trustLevels,
  awaitVerificationResult,
  broadcastMessage,
  // fetchIdentities,
  signaldEncode,
  getSocket,
  parseOutboundSdMessage,
  parseVerificationCode,
  register,
  sendMessage,
  sdMessageOf,
  subscribe,
  trust,
  verify,
  setExpiration,
}
