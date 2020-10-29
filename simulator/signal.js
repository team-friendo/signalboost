const socketWriter = require('./socket/write')
const callbacks = require('./callbacks')
const { pick, isEmpty } = require('lodash')
const fetch = require("node-fetch")
const { messages, messageTypes, trustLevels } = require('../app/signal/constants')
const util = require('../app/util')
const { statuses, loggerOf } = util
const {
  signal: { diagnosticsPhoneNumber, broadcastSpacing },
} = require('../app/config')
const logger = loggerOf('signal')

/**********************
 * STARTUP
 **********************/

const run = async (botPhoneNumbers, dbPool) => {
  logger.log(`--- Creating bot phoneNumbers...`)
  try {
    for (pn of botPhoneNumbers) {
      await register(pn, null, dbPool)
      await util.wait(1000)
    }
    logger.log(`--- Created bot phoneNumbers!!`)
    await Promise.all(botPhoneNumbers.map(subscribe))
    logger.log(`--- Subscribed bot phoneNumbers!`)
    return
  } catch (e) {
    logger.log(`--- Error creating bot phoneNumbers...  `)
    logger.error(e)
  }
}

/********************
 * SIGNALD COMMANDS
 ********************/

// (string, string || null) -> Promise<SignalboostStatus>
const register = async (phoneNumber, captchaToken, dbPool) => {
  logger.log(`${phoneNumber}: Registering...`)
  socketWriter.write({
    type: messageTypes.REGISTER,
    username: phoneNumber,
    ...(captchaToken ? { captcha: captchaToken } : {}),
  })

  await util.wait(10000)
  logger.log(`${phoneNumber}: Verifying...`)
  await verify(phoneNumber, dbPool)

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
const verify = async (phoneNumber, dbPool) => {

  const params = new URLSearchParams()
  params.append('number', phoneNumber)

  const code = await fetchVerificationCode(phoneNumber, dbPool)

  return socketWriter
    .write({ type: messageTypes.VERIFY, username: phoneNumber, code })
    .then(() => ({ status: statuses.SUCCESS, message: 'OK' }))
    .catch(e => ({ status: statuses.ERROR, message: e.message }))
}

const fetchVerificationCode = async (phoneNumber, dbPool) => {  
  const query = "SELECT verification_code FROM pending_accounts WHERE number = $1;"
  
  try {
    const { rows } = await dbPool.query(query, [phoneNumber])
    const verification_code = rows[0]["verification_code"]
    return verification_code
  } catch (e) {
    logger.error(`${phoneNumber}: Failed to fetch verification code`)
    logger.error(e)
  }
}

// string -> Promise<string>
const subscribe = phoneNumber =>
  socketWriter.write({ type: messageTypes.SUBSCRIBE, username: phoneNumber })

// (string, OutboundSignaldMessage) -> Promise<string>
const sendMessage = async (recipientNumber, sdMessage) => {
  const recipientAddress = { number: recipientNumber }
  const id = await socketWriter.write({ ...sdMessage, recipientAddress })
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

// string -> [boolean, string]
const parseVerificationCode = verificationMessage => {
  const matches = verificationMessage.match(/.*: (\d\d\d-\d\d\d)/)
  return isEmpty(matches) ? [false, verificationMessage] : [true, matches[1]]
}

module.exports = {
  messages,
  messageTypes,
  parseVerificationCode,
  register,
  run,
  sendMessage,
  subscribe,
  verify,
}
