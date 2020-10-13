const signal = require('../signal')
const callbacks = require('../signal/callbacks')
const channelRepository = require('../db/repositories/channel')
const membershipRepository = require('../db/repositories/membership')
const phoneNumberRegistrar = require('../registrar/phoneNumber')
const safetyNumbers = require('../registrar/safetyNumbers')
const diagnostics = require('../diagnostics')
const { memberTypes } = membershipRepository
const executor = require('./commands')
const messenger = require('./messenger')
const resend = require('./resend')
const logger = require('./logger')
const util = require('../util')
const { messagesIn } = require('./strings/messages')
const { get, isEmpty, isNumber } = require('lodash')
const { emphasize, redact } = require('../util')
const metrics = require('../metrics')
const {
  counters: { SIGNALD_MESSAGES, RELAYABLE_MESSAGES, ERRORS },
  errorTypes,
  messageDirection: { INBOUND },
} = metrics
const {
  defaultLanguage,
  signal: { diagnosticsPhoneNumber },
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
 *   socketPoolId: number,
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

// number => string => Promise<SignalboostStatus>
const dispatcherOf = socketPoolId => msg => dispatch(msg, socketPoolId).catch(logger.error)

// (string, number) -> Promise<SignalBoostStatus>
const dispatch = async (msg, socketPoolId) => {
  logger.debug(emphasize(redact(msg)))

  // parse basic info from message
  const inboundMsg = parseInboundSignaldMessage(msg)
  const channelPhoneNumber = get(inboundMsg, 'data.username', 'SYSTEM')

  // count what kind of message we are processing
  metrics.incrementCounter(SIGNALD_MESSAGES, [inboundMsg.type, channelPhoneNumber, INBOUND])

  // retrieve db info we need for dispatching
  const [channel, sender] = _isMessage(inboundMsg)
    ? await Promise.all([
        channelRepository.findDeep(inboundMsg.data.username),
        classifyPhoneNumber(
          get(inboundMsg, 'data.username'),
          get(inboundMsg, 'data.source.number'),
        ),
      ])
    : []

  // handle callbacks for messages that have request/response semantics
  callbacks.handle(inboundMsg, socketPoolId)

  // process any side-effects
  const sideEffects = await detectAndPerformSideEffects(channel, sender, inboundMsg)
  await util.sequence(sideEffects)

  // return early if we receive system messages that prompt interventions
  const interventions = await detectInterventions(channel, sender, inboundMsg)
  if (interventions) return interventions()

  // ... or if we recieve a non-relayable message
  if (!_isMessage(inboundMsg) || _isEmpty(inboundMsg)) return Promise.resolve()

  // else, follow the happy path!
  return relay(channel, sender, inboundMsg)
}

/**********************
 * DISPATCH HELPERS
 **********************/

// (Channel, string, SdMessage) => Promise<Array<function>>
const detectAndPerformSideEffects = async (channel, sender, inboundMsg) => {
  let sideEffects = []

  // Don't return early here b/c that would prevent processing of HELLO commands on channels w/ disappearing messages
  const newExpiryTime = detectUpdatableExpiryTime(inboundMsg, channel)
  if (isNumber(newExpiryTime))
    sideEffects.push(() => updateExpiryTime(sender, channel, newExpiryTime))

  // Don't return early here b/c the person "redeemed" channel by sending normal message that should be processed!
  if (channel && channel.recycleRequest)
    sideEffects.push(() => phoneNumberRegistrar.redeem(channel))

  return sideEffects
}

// (Channel | null, Sender | null, SdMessage) -> Promise<function | null>
const detectInterventions = async (channel, sender, inboundMsg) => {
  const healthcheckId = detectHealthcheck(inboundMsg)
  if (healthcheckId) return () => diagnostics.respondToHealthcheck(channel, healthcheckId)

  // return early from healthcheck responses to avoid infinite feedback loops!
  const isHealthcheckResponse = detectHealthcheckResponse(inboundMsg)
  if (isHealthcheckResponse) return () => Promise.resolve()

  const rateLimitedMessage = detectRateLimitedMessage(inboundMsg)
  if (rateLimitedMessage) return () => logAndResendRateLimitedMessage(rateLimitedMessage)

  const updatableFingerprint = await detectUpdatableFingerprint(inboundMsg)
  if (updatableFingerprint) return () => safetyNumbers.updateFingerprint(updatableFingerprint)
}

const relay = async (channel, sender, inboundMsg) => {
  const sdMessage = signal.parseOutboundSdMessage(inboundMsg)
  try {
    metrics.incrementCounter(RELAYABLE_MESSAGES, [channel.phoneNumber])
    const dispatchable = { channel, sender, sdMessage }
    const commandResult = await executor.processCommand(dispatchable)
    return messenger.dispatch({ dispatchable, commandResult })
  } catch (e) {
    logger.error(e)
  }
}

/******************
 * INTERVENTIONS
 *****************/

// InboundSdMessage => void
const logAndResendRateLimitedMessage = async rateLimitedMessage => {
  const channelPhoneNumber = rateLimitedMessage.username
  const socketPoolId = await channelRepository.getSocketPoolId(channelPhoneNumber)
  const resendInterval = resend.enqueueResend(rateLimitedMessage, socketPoolId)
  metrics.incrementCounter(ERRORS, [
    resendInterval ? errorTypes.RATE_LIMIT_RESENDING : errorTypes.RATE_LIMIT_ABORTING,
    channelPhoneNumber,
  ])
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

const _isMessage = inboundMsg =>
  inboundMsg.type === signal.messageTypes.MESSAGE && get(inboundMsg, 'data.dataMessage')

const _isEmpty = inboundMsg =>
  get(inboundMsg, 'data.dataMessage.body', '') === '' &&
  isEmpty(get(inboundMsg, 'data.dataMessage.attachments', []))

// InboundSingaldMessage => string | null
const detectHealthcheck = inboundMsg =>
  // determines if message is an inbound healtcheck; if so, returns its id; if not, returns null
  diagnosticsPhoneNumber &&
  get(inboundMsg, 'data.source.number') === diagnosticsPhoneNumber &&
  get(inboundMsg, 'data.dataMessage.body', '').match(signal.messageTypes.HEALTHCHECK) &&
  get(inboundMsg, 'data.dataMessage.body', '')
    .replace(signal.messageTypes.HEALTHCHECK, '')
    .trim()

// InboundSingaldMessage => string | null
const detectHealthcheckResponse = inboundMsg =>
  // determines if message is an inbound healtcheck response (and thus should not be relayed)
  Boolean(
    diagnosticsPhoneNumber &&
      get(inboundMsg, 'data.username') === diagnosticsPhoneNumber &&
      get(inboundMsg, 'data.dataMessage.body', '').match(signal.messageTypes.HEALTHCHECK_RESPONSE),
  )

/** InboundSdMessage -> UpdatableFingerprint | null **/
const detectUpdatableFingerprint = async inSdMessage => {
  if (inSdMessage.type !== signal.messageTypes.INBOUND_IDENTITY_FAILURE) return null

  const channelPhoneNumber = get(inSdMessage, 'data.local_address.number', '')
  const memberPhoneNumber = get(inSdMessage, 'data.remote_address.number', '')
  const membership = await membershipRepository.findMembership(
    channelPhoneNumber,
    memberPhoneNumber,
  )
  const language = membership ? membership.language : defaultLanguage

  return {
    channelPhoneNumber,
    memberPhoneNumber,
    fingerprint: get(inSdMessage, 'data.fingerprint', ''),
    sdMessage: {
      type: signal.messageTypes.SEND,
      username: channelPhoneNumber,
      messageBody: messagesIn(language).notifications.safetyNumberChanged,
    },
  }
}

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

module.exports = { dispatch, dispatcherOf }
