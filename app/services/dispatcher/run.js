const { wait } = require('../util')
const signal = require('../signal')
const { sdMessageOf } = signal
const channelRepository = require('./../../db/repositories/channel')
const membershipRepository = require('../../db/repositories/membership')
const { memberTypes } = membershipRepository
const executor = require('./commands')
const messenger = require('./messenger')
const logger = require('./logger')
const safetyNumberService = require('../registrar/safetyNumbers')
const { messagesIn } = require('./strings/messages')
const { get, isEmpty, find, map, values, isNumber } = require('lodash')
const { languages } = require('../../constants')
const {
  signal: { expiryUpdateDelay },
} = require('../../config')

/**
 * type Dispatchable = {
 *   db: SequelizeDatabaseConnection,
 *   sock: Socket,
 *   channel: models.Channel,
 *   sender: Sender,
 *   sdMessage: signal.OutBoundSignaldMessage,,
 * }
 *
 *  type UpdatableFingerprint = {
 *   channelPhoneNumber: string,
 *   memberPhoneNumber: string,
 *   fingerprint: string,
 *   sdMessage: SdMessage,
 * }
 *
 * type Sender = {
 *   phoneNumber: string,
 *   type: 'ADMIN', 'SUBSCRIBER', 'NONE',
 *   language: 'EN', 'ES',
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
    sock.on('data', inboundMsg => dispatch(db, sock, parseMessage(inboundMsg)).catch(logger.error))
    return listening
  })

/********************
 * MESSAGE DISPATCH
 *******************/

const dispatch = async (db, sock, inboundMsg) => {
  // retrieve db info we need for dispatching...
  const [channel, sender] = _isMessage(inboundMsg)
    ? await Promise.all([
        channelRepository.findDeep(db, inboundMsg.data.username),
        classifyPhoneNumber(db, inboundMsg.data.username, inboundMsg.data.source),
      ])
    : []

  // dispatch system-created messages
  const newFingerprint = detectUpdatableFingerprint(inboundMsg)
  if (newFingerprint) return updateFingerprint(db, sock, newFingerprint)

  const newExpiryTime = detectUpdatableExpiryTime(inboundMsg, channel)
  if (isNumber(newExpiryTime)) return updateExpiryTime(db, sock, sender, channel, newExpiryTime)

  // dispatch user-created messages
  if (shouldRelay(inboundMsg)) return relay(db, sock, channel, sender, inboundMsg)
}

const relay = async (db, sock, channel, sender, inboundMsg) => {
  const sdMessage = signal.parseOutboundSdMessage(inboundMsg)
  try {
    const dispatchable = { db, sock, channel, sender, sdMessage }
    const commandResult = await executor.processCommand(dispatchable)
    return messenger.dispatch({ dispatchable, commandResult })
  } catch (e) {
    logger.error(e)
  }
}

const updateFingerprint = async (db, sock, updatableFingerprint) => {
  const { channelPhoneNumber, memberPhoneNumber, sdMessage } = updatableFingerprint
  try {
    const recipient = await classifyPhoneNumber(db, channelPhoneNumber, memberPhoneNumber)
    if (recipient.type === memberTypes.NONE) return Promise.resolve()
    if (recipient.type === memberTypes.ADMIN && !isWelcomeMessage(sdMessage)) {
      // If it's a welcome message, someone just re-authorized this recipient, we want to re-trust their keys
      return safetyNumberService
        .deauthorize(db, sock, channelPhoneNumber, memberPhoneNumber)
        .then(logger.logAndReturn)
        .catch(logger.error)
    }
    return safetyNumberService
      .trustAndResend(db, sock, updatableFingerprint)
      .then(logger.logAndReturn)
      .catch(logger.error)
  } catch (e) {
    return logger.error(e)
  }
}

// (Database, Socket, Channel, number) -> Promise<void>
const updateExpiryTime = async (db, sock, sender, channel, messageExpiryTime) => {
  if (sender.type !== memberTypes.ADMIN) {
    // override a disappearing message time set by a subscriber or rando
    await signal.setExpiration(
      sock,
      channel.phoneNumber,
      sender.phoneNumber,
      channel.messageExpiryTime,
    )
    // wait 200ms for less jarring UX for sender
    await wait(expiryUpdateDelay)
    return signal.sendMessage(
      sock,
      sender.phoneNumber,
      sdMessageOf(channel, messagesIn(sender.language).notifications.expiryUpdateNotAuthorized),
    )
  }
  // enforce a disappearing message time set by an admin
  await channelRepository.update(db, channel.phoneNumber, { messageExpiryTime })
  return Promise.all(
    channel.memberships.map(m =>
      signal.setExpiration(sock, channel.phoneNumber, m.memberPhoneNumber, messageExpiryTime),
    ),
  )
}

/******************
 * MESSAGE PARSING
 ******************/

const parseMessage = inboundMsg => {
  try {
    return JSON.parse(inboundMsg)
  } catch (e) {
    return inboundMsg
  }
}

const shouldRelay = inboundMsg => _isMessage(inboundMsg) && !_isEmpty(inboundMsg)

const _isMessage = inboundMsg =>
  inboundMsg.type === signal.messageTypes.MESSAGE && get(inboundMsg, 'data.dataMessage')

const _isEmpty = inboundMsg =>
  get(inboundMsg, 'data.dataMessage.message') === '' &&
  isEmpty(get(inboundMsg, 'data.dataMessage.attachments'))

// (SdMessage, Channel) -> UpdatableExpiryTime?
const detectUpdatableExpiryTime = (inboundMsg, channel) =>
  _isMessage(inboundMsg) &&
  inboundMsg.data.dataMessage.expiresInSeconds !== channel.messageExpiryTime
    ? inboundMsg.data.dataMessage.expiresInSeconds
    : null

// SdMessage ->  UpdateableFingerprint?
const detectUpdatableFingerprint = inboundMsg => {
  if (inboundMsg.type === signal.messageTypes.UNTRUSTED_IDENTITY) {
    // indicates a failed outbound message (from channel to recipient with new safety number)
    return {
      channelPhoneNumber: inboundMsg.data.username,
      memberPhoneNumber: inboundMsg.data.number,
      fingerprint: inboundMsg.data.fingerprint,
      sdMessage: inboundMsg.data.request,
    }
  }
  /**
   * TODO(aguestuser|2019-12-28):
   *  handle failed incoming messages here once an upstream issue around preserving fingerprints
   *  from exceptions of type `UntrustedIdentityException` is resolved:
   *  https://gitlab.com/thefinn93/signald/issues/4#note_265584999
   *  (atm: signald returns a not very useful `'type': 'unreadable_message'` message)
   **/
  return null
}

const classifyPhoneNumber = async (db, channelPhoneNumber, senderPhoneNumber) => {
  // TODO(aguestuser|2019-12-02): do this with one db query!
  const type = await membershipRepository.resolveSenderType(
    db,
    channelPhoneNumber,
    senderPhoneNumber,
  )
  const language = await membershipRepository.resolveSenderLanguage(
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
  // produce an array of message strings in every language
  // test if incoming message is a welcome message in each language
  return Boolean(
    find(
      map(values(languages), messagesIn),
      messages =>
        strippedMessage === messages.notifications.welcome('', '').trim() || //if added by another admin
        strippedMessage === messages.notifications.welcome(messages.systemName, '').trim(), //if added by sysadmin
    ),
  )
}

// EXPORTS

module.exports = { run }
