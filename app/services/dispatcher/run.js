const signal = require('../signal')
const channelRepository = require('./../../db/repositories/channel')
const executor = require('./commands')
const messenger = require('./messenger')
const logger = require('./logger')
const safetyNumberService = require('../registrar/safetyNumbers')
const { messagesIn } = require('./strings/messages')
const { get } = require('lodash')
const { memberTypes } = require('../../db/repositories/channel')
const { defaultLanguage } = require('../../config')

/**
 * type Dispatchable = {
 *   db: SequelizeDatabaseConnection,
 *   sock: Socket,
 *   channel: models.Channel,
 *   sender: Sender,
 *   sdMessage: signal.OutBoundSignaldMessage,,
 * }
 *
 * type Sender = {
 *   phoneNumber: string,
 *   isPublisher: boolean,
 *   isSubscriber: boolean,
 * }
 *
 * type CommandResult = {
 *   status: string,
 *   command: string,
 *   message: string,
 * }
 *
 * type SignalBoostStatus = {
 *   status: 'SUCCESS' | 'ERROR',
 *   message; string
 * }
 */

/******************
 *INITIALIZATION
 *****************/

const run = async (db, sock) => {
  logger.log('--- Initializing Dispatcher....')

  // for debugging...
  // sock.on('data', data => console.log(`+++++++++\n${data}\n++++++++\n`))

  logger.log(`----- Subscribing to channels...`)
  const channels = await channelRepository.findAllDeep(db).catch(logger.fatalError)
  const listening = await listenForInboundMessages(db, sock, channels).catch(logger.fatalError)
  logger.log(`----- Subscribed to ${listening.length} of ${channels.length} channels!`)

  logger.log(`--- Dispatcher running!`)
}

const listenForInboundMessages = async (db, sock, channels) =>
  Promise.all(channels.map(ch => signal.subscribe(sock, ch.phoneNumber))).then(listening => {
    sock.on('data', inboundMsg => dispatch(db, sock, parseMessage(inboundMsg)))
    return listening
  })

/********************
 * MESSAGE DISPATCH
 *******************/

const dispatch = async (db, sock, inboundMsg) => {
  if (shouldRelay(inboundMsg)) return relay(db, sock, inboundMsg)
  if (shouldUpdateSafetyNumber(inboundMsg)) return updateSafetyNumber(db, sock, inboundMsg)
  return Promise.resolve()
}

const relay = async (db, sock, inboundMsg) => {
  const channelPhoneNumber = inboundMsg.data.username
  const sdMessage = signal.parseOutboundSdMessage(inboundMsg)
  try {
    const [channel, sender] = await Promise.all([
      channelRepository.findDeep(db, channelPhoneNumber),
      classifyPhoneNumber(db, channelPhoneNumber, inboundMsg.data.source),
    ])
    const dispatchable = { db, sock, channel, sender, sdMessage }
    const commandResult = await executor.processCommand(dispatchable)
    return messenger.dispatch({ dispatchable, commandResult })
  } catch (e) {
    logger.error(e)
  }
}

const updateSafetyNumber = async (db, sock, inboundMsg) => {
  const sdMessage = inboundMsg.data.request
  const channelPhoneNumber = sdMessage.username
  const memberPhoneNumber = sdMessage.recipientNumber

  const recipient = await classifyPhoneNumber(db, channelPhoneNumber, memberPhoneNumber).catch(
    logger.error,
  )

  if (recipient.type === memberTypes.NONE) return Promise.resolve()
  if (recipient.type === memberTypes.PUBLISHER && !isWelcomeMessage(sdMessage)) {
    // If it's a welcome message, someone just re-authorized this recipient, we want to re-trust their keys
    return safetyNumberService
      .deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber)
      .then(logger.logAndReturn)
      .catch(logger.error)
  }
  return safetyNumberService
    .trustAndResend(db, sock, channelPhoneNumber, memberPhoneNumber, sdMessage)
    .then(logger.logAndReturn)
    .catch(logger.error)
}

/************
 * HELPERS
 ***********/

const parseMessage = inboundMsg => {
  try {
    return JSON.parse(inboundMsg)
  } catch (e) {
    return inboundMsg
  }
}

const shouldRelay = inboundMsg =>
  inboundMsg.type === signal.messageTypes.MESSAGE && get(inboundMsg, 'data.dataMessage')

const shouldUpdateSafetyNumber = inboundMsg =>
  inboundMsg.type === signal.messageTypes.ERROR &&
  get(inboundMsg, 'data.request.type') === signal.messageTypes.SEND &&
  !get(inboundMsg, 'data.message', '').includes('Rate limit')

const classifyPhoneNumber = async (db, channelPhoneNumber, senderPhoneNumber) => {
  const type = await channelRepository.resolveSenderType(db, channelPhoneNumber, senderPhoneNumber)
  const language = await channelRepository.resolveSenderLanguage(
    db,
    channelPhoneNumber,
    senderPhoneNumber,
    type,
  )
  return { phoneNumber: senderPhoneNumber, type, language }
}

const isWelcomeMessage = sdMessage => {
  const phoneNumberPattern = /\+\d{9,15}/g
  const headerPattern = /\[.*]\n\n/
  const strippedMessage = sdMessage.messageBody
    .replace(headerPattern, '')
    .replace(phoneNumberPattern, '')
    .trim()
  return Boolean(
    // TODO(aguestuser|2019-09-26):
    //  properly localize this, by including more languages in the input array here!
    [messagesIn(defaultLanguage)].find(
      messages =>
        strippedMessage === messages.notifications.welcome('', '').trim() || //if added by another admin
        strippedMessage === messages.notifications.welcome(messages.systemName, '').trim(), //if added by sysadmin
    ),
  )
}

// EXPORTS

module.exports = { run }
