const signal = require('../signal')
const callbacks = require('../signal/callbacks')
const channelRepository = require('../db/repositories/channel')
const membershipRepository = require('../db/repositories/membership')
const { memberTypes } = membershipRepository
const executor = require('./commands')
const messenger = require('./messenger')
const resend = require('./resend')
const logger = require('./logger')
const { messagesIn } = require('./strings/messages')
const { get, isEmpty, isNumber } = require('lodash')
const metrics = require('../metrics')
const { counters, errorTypes } = metrics
const { emphasize, redact } = require('../util')
const { defaultLanguage } = require('../config')

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

// string -> Promise<SignalBoostStatus>
const dispatch = async msg => {
  logger.debug(emphasize(redact(msg)))
  const inboundMsg = parseInboundSignaldMessage(msg)
  const channelPhoneNumber = get(inboundMsg, 'data.username', 'noPhoneNumberType')
  metrics.incrementCounter(counters.SIGNALD_MESSAGES, [
    inboundMsg.type,
    channelPhoneNumber,
    metrics.messageDirection.INBOUND,
  ])
  // retrieve db info we need for dispatching...
  const [channel, sender] = _isMessage(inboundMsg)
    ? await Promise.all([
        channelRepository.findDeep(inboundMsg.data.username),
        classifyPhoneNumber(
          get(inboundMsg, 'data.username'),
          get(inboundMsg, 'data.source.number'),
        ),
      ])
    : []

  // detect and handle callbacks if any
  callbacks.handle(inboundMsg)

  // dispatch system-created messages
  const rateLimitedMessage = detectRateLimitedMessage(inboundMsg)
  if (rateLimitedMessage) {
    // TODO(aguestuser|2020-07-08): extract a `handleRateLimitedMessage` helper here?
    const _channelPhoneNumber = rateLimitedMessage.username
    const resendInterval = resend.enqueueResend(rateLimitedMessage)
    logger.log(
      messagesIn(defaultLanguage).notifications.rateLimitOccurred(
        _channelPhoneNumber,
        resendInterval,
      ),
    )
    metrics.incrementCounter(counters.ERRORS, [
      resendInterval ? errorTypes.RATE_LIMIT_RESENDING : errorTypes.RATE_LIMIT_ABORTING,
      _channelPhoneNumber,
    ])
    return Promise.resolve()
  }

  const newExpiryTime = detectUpdatableExpiryTime(inboundMsg, channel)
  // GOTCHA: Don't return early here b/c that would prevent HELLO commands on channels w/
  // disappearing messages from ever being processed!
  if (isNumber(newExpiryTime)) await updateExpiryTime(sender, channel, newExpiryTime)

  // dispatch user-created messages
  if (shouldRelay(inboundMsg)) return relay(channel, sender, inboundMsg)
}

const relay = async (channel, sender, inboundMsg) => {
  const sdMessage = signal.parseOutboundSdMessage(inboundMsg)
  try {
    metrics.incrementCounter(counters.RELAYABLE_MESSAGES, [channel.phoneNumber])
    const dispatchable = { channel, sender, sdMessage }
    const commandResult = await executor.processCommand(dispatchable)
    return messenger.dispatch({ dispatchable, commandResult })
  } catch (e) {
    logger.error(e)
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

const parseInboundSignaldMessage = inboundMsg => {
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
  get(inboundMsg, 'data.dataMessage.body', '') === '' &&
  isEmpty(get(inboundMsg, 'data.dataMessage.attachments', []))

// InboundSdMessage -> SdMessage?
const detectRateLimitedMessage = inboundMsg =>
  inboundMsg.type === signal.messageTypes.ERROR &&
  (get(inboundMsg, 'data.message', '').includes('413') ||
    get(inboundMsg, 'data.message', '').includes('Rate limit'))
    ? inboundMsg.data.request
    : null

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

module.exports = { dispatch }
