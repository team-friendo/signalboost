const signal = require('../signal')
const { sdMessageOf, messageTypes } = signal
const channelRepository = require('../db/repositories/channel')
const membershipRepository = require('../db/repositories/membership')
const { memberTypes } = membershipRepository
const executor = require('./commands')
const messenger = require('./messenger')
const resend = require('./resend')
const logger = require('./logger')
const safetyNumberService = require('../registrar/safetyNumbers')
const { messagesIn } = require('./strings/messages')
const { get, isEmpty, isNumber } = require('lodash')
const app = require('../index')
const metrics = require('../metrics')
const {
  signal: { supportPhoneNumber },
} = require('../config')

/**
 * type Dispatchable = {
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

const run = async () => {
  logger.log('--- Initializing Dispatcher....')

  // TODO: log this or not based on env var value
  // sock.on('data', data => console.log(`+++++++++\n${data}\n++++++++\n`))

  logger.log(`----- Subscribing to channels...`)

  const resendQueue = {}
  const channels = await channelRepository.findAllDeep().catch(logger.fatalError)
  const numListening = await Promise.all(channels.map(ch => signal.subscribe(ch.phoneNumber)))
  app.sock.on('data', msg => dispatch(msg, resendQueue).catch(logger.error))

  logger.log(`----- Subscribed to ${numListening.length} of ${channels.length} channels!`)
  logger.log(`--- Dispatcher running!`)
}

/********************
 * MESSAGE DISPATCH
 *******************/

const dispatch = async (rawMessage, resendQueue) => {
  const inboundMsg = parseMessage(rawMessage)
  const channelPhoneNumber = get(inboundMsg, 'data.username', 'noPhoneNumberType')
  metrics.incrementCounter(metrics.counters.SIGNALD_MESSAGES, [
    inboundMsg.type,
    channelPhoneNumber,
    metrics.messageDirection.INBOUND,
  ])
  // retrieve db info we need for dispatching...
  const [channel, sender] = _isMessage(inboundMsg)
    ? await Promise.all([
        channelRepository.findDeep(inboundMsg.data.username),
        classifyPhoneNumber(inboundMsg.data.username, inboundMsg.data.source),
      ])
    : []

  // dispatch system-created messages
  const rateLimitedMessage = detectRateLimitedMessage(inboundMsg, resendQueue)
  if (rateLimitedMessage) {
    const resendInterval = resend.enqueueResend(resendQueue, rateLimitedMessage)
    return notifyRateLimitedMessage(rateLimitedMessage, resendInterval)
  }

  const newFingerprint = detectUpdatableFingerprint(inboundMsg)
  if (newFingerprint) return updateFingerprint(newFingerprint)

  /***** GOTCHA WARNING!!! *****
   *
   * We don't return early from calling `updateExpiryTime` b/c that would cause
   * messages from new users (who likely have disapparing messages to 0) to channels with
   * disappearing messages enabled to return early here and never be considered for execution
   * or relay.
   *
   * In particular, it would cause HELLO messages frompeople trying to subscribe to channels
   * with disappearing messages enabled to be dropped!
   **/
  const newExpiryTime = detectUpdatableExpiryTime(inboundMsg, channel)
  if (isNumber(newExpiryTime)) await updateExpiryTime(sender, channel, newExpiryTime)

  // dispatch user-created messages
  if (shouldRelay(inboundMsg)) return relay(channel, sender, inboundMsg)
}

const relay = async (channel, sender, inboundMsg) => {
  const sdMessage = signal.parseOutboundSdMessage(inboundMsg)
  try {
    metrics.incrementCounter(metrics.counters.RELAYABLE_MESSAGES, [channel.phoneNumber])
    const dispatchable = { channel, sender, sdMessage }
    const commandResult = await executor.processCommand(dispatchable)
    return messenger.dispatch({ dispatchable, commandResult })
  } catch (e) {
    logger.error(e)
  }
}

// (Database, Socket, SdMessage, number) -> Promise<void>
const notifyRateLimitedMessage = async (sdMessage, resendInterval) => {
  const channel = await channelRepository.findDeep(supportPhoneNumber)
  if (!channel) return Promise.resolve()

  const recipients = channelRepository.getAdminMemberships(channel)
  return Promise.all(
    recipients.map(({ memberPhoneNumber, language }) =>
      signal.sendMessage(
        memberPhoneNumber,
        sdMessageOf(
          { phoneNumber: supportPhoneNumber },
          messagesIn(language).notifications.rateLimitOccurred(sdMessage.username, resendInterval),
        ),
      ),
    ),
  )
}

const updateFingerprint = async updatableFingerprint => {
  const { channelPhoneNumber, memberPhoneNumber } = updatableFingerprint
  try {
    const recipient = await classifyPhoneNumber(channelPhoneNumber, memberPhoneNumber)
    if (recipient.type === memberTypes.NONE) return Promise.resolve()
    if (recipient.type === memberTypes.ADMIN) {
      return safetyNumberService
        .deauthorize(updatableFingerprint)
        .then(logger.logAndReturn)
        .catch(logger.error)
    }
    return safetyNumberService
      .trustAndResend(updatableFingerprint)
      .then(logger.logAndReturn)
      .catch(logger.error)
  } catch (e) {
    return logger.error(e)
  }
}

// (Database, Socket, Channel, number) -> Promise<void>
const updateExpiryTime = async (sender, channel, messageExpiryTime) => {
  switch (sender.type) {
    case memberTypes.NONE:
      return Promise.resolve()
    case memberTypes.SUBSCRIBER:
      // override a disappearing message time set by a subscriber or rando
      return signal.setExpiration(
        channel.phoneNumber,
        sender.phoneNumber,
        channel.messageExpiryTime,
      )
    case memberTypes.ADMIN:
      // enforce a disappearing message time set by an admin
      await channelRepository.update(channel.phoneNumber, { messageExpiryTime })
      return Promise.all(
        channel.memberships
          .filter(m => m.memberPhoneNumber !== sender.phoneNumber)
          .map(m =>
            signal.setExpiration(channel.phoneNumber, m.memberPhoneNumber, messageExpiryTime),
          ),
      )
  }
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

// InboundSdMessage -> SdMessage?
const detectRateLimitedMessage = inboundMsg =>
  inboundMsg.type === signal.messageTypes.ERROR &&
  (get(inboundMsg, 'data.message', '').includes('413') ||
    get(inboundMsg, 'data.message', '').includes('Rate limit'))
    ? inboundMsg.data.request
    : null

// SdMessage ->  UpdateableFingerprint?
const detectUpdatableFingerprint = inboundMsg => {
  if (inboundMsg.type === messageTypes.UNTRUSTED_IDENTITY) {
    // indicates a failed outbound message (from channel to recipient with new safety number)
    return {
      channelPhoneNumber: inboundMsg.data.username,
      memberPhoneNumber: inboundMsg.data.number,
      fingerprint: inboundMsg.data.fingerprint,
      sdMessage: signal.parseOutboundSdMessage(inboundMsg.data.request),
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

// (SdMessage, Channel) -> UpdatableExpiryTime?
const detectUpdatableExpiryTime = (inboundMsg, channel) =>
  _isMessage(inboundMsg) &&
  inboundMsg.data.dataMessage.expiresInSeconds !== get(channel, 'messageExpiryTime')
    ? inboundMsg.data.dataMessage.expiresInSeconds
    : null

const classifyPhoneNumber = async (channelPhoneNumber, senderPhoneNumber) => {
  // TODO(aguestuser|2019-12-02): do this with one db query!
  const type = await membershipRepository.resolveMemberType(channelPhoneNumber, senderPhoneNumber)
  const language = await membershipRepository.resolveSenderLanguage(
    channelPhoneNumber,
    senderPhoneNumber,
    type,
  )
  return { phoneNumber: senderPhoneNumber, type, language }
}

// EXPORTS

module.exports = { run, dispatch }
