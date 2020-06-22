const app = require('./index')
const { pick, get, isEmpty } = require('lodash')
const { wait } = require('./util.js')
const { statuses } = require('./util')
const socket = require('./socket')
const {
  signal: { verificationTimeout, signaldRequestTimeout },
} = require('./config')

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

// CONSTANTS

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
  UNSUBSCRIBE: 'unsubscribe',
  VERIFICATION_ERROR: 'verification_error',
  VERIFICATION_REQUIRED: 'verification_required',
  VERIFICATION_SUCCESS: 'verification_succeeded',
  VERIFY: 'verify',
  VERSION: 'version',
}

const trustLevels = {
  TRUSTED_VERIFIED: 'TRUSTED_VERIFIED',
  TRUSTED_UNVERIFIED: 'TRUSTED_UNVERIFIED',
  UNTRUSTED: 'UNTRUSTED',
}

const messages = {
  error: {
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

/********************
 * SIGNALD COMMANDS
 ********************/

const register = phoneNumber => socket.write({ type: messageTypes.REGISTER, username: phoneNumber })

const verify = (phoneNumber, code) =>
  socket.write({ type: messageTypes.VERIFY, username: phoneNumber, code })

const awaitVerificationResult = async phoneNumber => {
  return new Promise((resolve, reject) => {
    app.sock.on('data', function handle(msg) {
      const { type, data } = safeJsonParse(msg, reject)
      if (type === null && data === null) {
        reject(new Error(messages.error.invalidJSON(msg)))
      } else if (_isVerificationFailure(type, data, phoneNumber)) {
        app.sock.removeListener('data', handle)
        const reason = get(data, 'message', 'Captcha required: 402')
        reject(new Error(messages.error.verificationFailure(phoneNumber, reason)))
      } else if (_isVerificationSuccess(type, data, phoneNumber)) {
        app.sock.removeListener('data', handle)
        resolve(data)
      } else if (_isVerificationFailure(type, data, phoneNumber)) {
        app.sock.removeListener('data', handle)
        const reason = get(data, 'message', 'Captcha required: 402')
        reject(new Error(messages.error.verificationFailure(phoneNumber, reason)))
      } else {
        // on first message (reporting registration) set timeout for listening to subsequent messages
        wait(verificationTimeout).then(() => {
          app.sock.removeListener('data', handle)
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

// string -> Promise<void>
const subscribe = phoneNumber =>
  socket.write({ type: messageTypes.SUBSCRIBE, username: phoneNumber })

const unsubscribe = phoneNumber =>
  socket.write({ type: messageTypes.UNSUBSCRIBE, username: phoneNumber })

const sendMessage = (recipientNumber, outboundMessage) =>
  socket.writeWithPool({ ...outboundMessage, recipientNumber })

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

// (Socket, String, String, String?) -> Promise<Array<TrustResult>>
const trust = async (channelPhoneNumber, memberPhoneNumber, fingerprint) => {
  // don't await first socket.write so we can start listening sooner!
  socket.write({
    type: messageTypes.TRUST,
    username: channelPhoneNumber,
    recipientNumber: memberPhoneNumber,
    fingerprint,
  })
  return _awaitTrustVerification(channelPhoneNumber, memberPhoneNumber, fingerprint)
}

// (Socket, string, string) => Promise<TrustResult>
const _awaitTrustVerification = async (channelPhoneNumber, memberPhoneNumber, fingerprint) => {
  return new Promise((resolve, reject) => {
    // create handler
    const handle = msg => {
      const { type, data } = safeJsonParse(msg, reject)
      if (type === null && data === null) {
        // ignore bad JSON
        app.sock.removeListener('data', handle)
        return Promise.resolve()
      } else if (
        type === messageTypes.TRUSTED_FINGERPRINT &&
        data.request.fingerprint === fingerprint
      ) {
        // return success if we get a trust response
        app.sock.removeListener('data', handle)
        resolve({
          status: statuses.SUCCESS,
          message: messages.trust.success(channelPhoneNumber, memberPhoneNumber),
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
        message: messages.error.trustTimeout(channelPhoneNumber, memberPhoneNumber),
      })
    })
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
  messageTypes,
  messages,
  trustLevels,
  awaitVerificationResult,
  broadcastMessage,
  isAlive,
  parseOutboundSdMessage,
  parseOutboundAttachment,
  parseVerificationCode,
  register,
  sendMessage,
  sdMessageOf,
  subscribe,
  trust,
  verify,
  setExpiration,
  unsubscribe,
}
