const socketWriter = require('./socket/write')
const callbacks = require('./callbacks')
const { isEmpty } = require('lodash')
const fetch = require('node-fetch')
const { messages, messageTypes } = require('../app/signal/constants')
const util = require('../app/util')
const { statuses, loggerOf } = util
const logger = loggerOf('signal')

/**********************
 * STARTUP
 **********************/

const run = async botPhoneNumbers => {
  try {
    await Promise.all(botPhoneNumbers.map(subscribe))
    logger.log(`--- Subscribed bot phoneNumbers!`)
    return Promise.resolve()
  } catch (e) {
    logger.log(`--- Error subscribing to bot phoneNumbers...  `)
    logger.error(e)
  }
}

/********************
 * SIGNALD COMMANDS
 ********************/

// (string, string || null) -> Promise<SignalboostStatus>
const registerAndVerify = async phoneNumber => {
  logger.log(`${phoneNumber}: Registering...`)
  socketWriter.write({
    type: messageTypes.REGISTER,
    username: phoneNumber,
  })

  await new Promise((resolve, reject) =>
    callbacks.register({
      messageType: messageTypes.REGISTER,
      id: phoneNumber,
      resolve,
      reject,
    }),
  )

  logger.log(`${phoneNumber}: Verifying...`)
  await verify(phoneNumber)

  return new Promise((resolve, reject) =>
    callbacks.register({
      messageType: messageTypes.VERIFY,
      id: phoneNumber,
      resolve,
      reject,
    }),
  )
}

// (string) -> Promise<SignalboostStatus>
const verify = async phoneNumber => {
  const code = await fetchVerificationCode(phoneNumber)

  return socketWriter
    .write({ type: messageTypes.VERIFY, username: phoneNumber, code })
    .then(() => ({ status: statuses.SUCCESS, message: 'OK' }))
    .catch(e => ({ status: statuses.ERROR, message: e.message }))
}

const fetchVerificationCode = async (phoneNumber, retries = 3) => {
  try {
    const response = await fetch(`https://coderetriever.signalboost.info/phone/${phoneNumber}`)
    const data = await response.json()

    if (!data.verificationCode) {
      if (retries > 0) {
        await util.wait(1000)
        return fetchVerificationCode(phoneNumber, retries - 1)
      } else {
        throw new Error()
      }
    }

    return data.verificationCode
  } catch (e) {
    logger.error(`${phoneNumber}: Failed to fetch verification code`)
  }
}

// string -> Promise<string>
const subscribe = phoneNumber =>
  socketWriter.write({ type: messageTypes.SUBSCRIBE, username: phoneNumber })

// (string, OutboundSignaldMessage) -> Promise<number|null>
const sendMessage = async (recipientNumber, sdMessage) => {
  const recipientAddress = { number: recipientNumber }
  try {
    const id = await socketWriter.write({ ...sdMessage, recipientAddress })
    const result = await new Promise((resolve, reject) => 
      callbacks.register({
        id,
        messageType: messageTypes.SEND,
        state: { whenSent: util.nowInMillis() },
        resolve,
        reject,
      })
    )
    return result
  } catch(e) {
    logger.error(`Error sending to ${recipientNumber}: ${e}`)
    return null
  }
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
  registerAndVerify,
  run,
  sendMessage,
  subscribe,
  verify,
}
