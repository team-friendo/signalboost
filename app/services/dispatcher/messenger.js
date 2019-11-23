const signal = require('../signal')
const { messagesIn } = require('./strings/messages')
const { sdMessageOf } = require('../signal')
const { memberTypes } = require('../../db/repositories/membership')
const { values } = require('lodash')
const { commands, statuses } = require('./commands/constants')
const messageCountRepository = require('../../db/repositories/messageCount')
const { wait } = require('../util')
const {
  defaultLanguage,
  signal: { signupPhoneNumber, resendDelay },
} = require('../../config')

/**
 * type MessageType = 'BROADCAST_MESSAGE' | 'COMMAND_RESULT' | 'NOTIFICATION'
 */

const messageTypes = {
  BROADCAST_MESSAGE: 'BROADCAST_MESSAGE',
  BROADCAST_RESPONSE: 'BROADCAST_RESPONSE',
  COMMAND_RESULT: 'COMMAND_RESULT',
  NEW_ADMIN_WELCOME: 'NEW_ADMIN_WELCOME',
  SIGNUP_MESSAGE: 'SIGNUP_MESSAGE',
}

const { BROADCAST_MESSAGE, BROADCAST_RESPONSE, COMMAND_RESULT, SIGNUP_MESSAGE } = messageTypes

const { ADMIN } = memberTypes

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  const messageType = parseMessageType(commandResult, dispatchable)
  switch (messageType) {
    case BROADCAST_MESSAGE:
      return broadcast(dispatchable)
    case BROADCAST_RESPONSE:
      return handleBroadcastResponse(dispatchable)
    case COMMAND_RESULT:
      return handleCommandResult({ commandResult, dispatchable })
    case SIGNUP_MESSAGE:
      return handleSignupMessage(dispatchable)
    default:
      return Promise.reject(`Invalid message. Must be one of: ${values(messageTypes)}`)
  }
}

// (CommandResult, Dispatchable) -> MessageType
const parseMessageType = (commandResult, { sender, channel }) => {
  if (commandResult.status === statuses.NOOP) {
    if (sender.type === ADMIN) return BROADCAST_MESSAGE
    if (channel.phoneNumber === signupPhoneNumber) return SIGNUP_MESSAGE
    return BROADCAST_RESPONSE
  }
  return COMMAND_RESULT
}

const handleSignupMessage = async ({ sock, channel, sender, sdMessage }) => {
  const notifications = messagesIn(defaultLanguage).notifications
  // TODO(aguestuser|2019-11-09): send this as a disappearing message
  // notify admins of signup request
  await notify({
    sock,
    channel,
    notification: notifications.signupRequestReceived(sender.phoneNumber, sdMessage.messageBody),
    recipients: channel.publications.map(p => p.publisherPhoneNumber),
  })
  // respond to signpu requester
  return notify({
    sock,
    channel,
    notification: notifications.signupRequestResponse,
    recipients: [sender.phoneNumber],
  })
}

const handleBroadcastResponse = dispatchable => {
  const {
    channel: { responsesEnabled },
    sender: { language },
  } = dispatchable

  if (!responsesEnabled) {
    return respond({
      ...dispatchable,
      message: messagesIn(language).notifications.unauthorized,
      status: statuses.UNAUTHORIZED,
    })
  }
  return relayBroadcastResponse(dispatchable)
}

const handleCommandResult = async ({ commandResult, dispatchable }) => {
  const { message, command, status } = commandResult
  await respond({ ...dispatchable, message, command, status })
  await wait(resendDelay)
  return handleNotifications({ commandResult, dispatchable })
}

// ({ CommandResult, Dispatchable )) -> SignalboostStatus
const handleNotifications = async ({ commandResult, dispatchable }) => {
  // TODO: respond to sender, notify all other publishers
  //  - exclude: HELP/INFO
  //  - include but don't add phone numbers: JOIN/LEAVE
  //  - include and add publisher phone numbers: RENAME/ADD/REMOVE/RESPONSES
  const { command, status, payload } = commandResult
  const { db, sock, channel, sender } = dispatchable
  const notifyBase = { db, sock, channel }
  if (command === commands.ADD && status === statuses.SUCCESS) {
    // welcome new publisher
    await notify({
      ...notifyBase,
      notification: messagesIn(sender.language).notifications.welcome(
        sender.phoneNumber,
        channel.phoneNumber,
      ),
      recipients: [payload],
    })
    return notify({
      ...notifyBase,
      notification: messagesIn(sender.language).notifications.publisherAdded(
        sender.phoneNumber,
        payload,
      ),
      // don't send to newly added publisher, that would mess up safety number re-trusting!
      recipients: channel.publications
        .map(p => p.publisherPhoneNumber)
        .filter(pNum => pNum !== payload),
    })
  }
}

/************
 * SENDING
 ************/

// Dispatchable -> Promise<void>
const broadcast = async ({ db, sock, channel, sdMessage }) => {
  const recipients = [
    ...channel.subscriptions.map(s => s.subscriberPhoneNumber),
    ...channel.publications.map(p => p.publisherPhoneNumber),
  ]
  return signal
    .broadcastMessage(sock, recipients, format({ channel, sdMessage }))
    .then(() => countBroacast({ db, channel }))
}

// Dispatchable -> Promise<void>
const relayBroadcastResponse = async ({ db, sock, channel, sender, sdMessage }) => {
  const { language } = sender
  const recipients = channel.publications.map(p => p.publisherPhoneNumber)
  const notification = messagesIn(language).notifications.broadcastResponseSent(channel)
  const outMessage = format({ channel, sdMessage, messageType: BROADCAST_RESPONSE, language })
  return signal
    .broadcastMessage(sock, recipients, outMessage)
    .then(() => countBroacast({ db, channel }))
    .then(() => respond({ db, sock, channel, sender, message: notification }))
}

// (DbusInterface, string, Sender, string?, string?) -> Promise<void>
const respond = ({ db, sock, channel, message, sender, command }) => {
  const outMessage = format({
    channel,
    sdMessage: sdMessageOf(channel, message),
    command,
    language: sender.language,
  })
  return signal
    .sendMessage(sock, sender.phoneNumber, outMessage)
    .then(() => countCommand({ db, channel }))
}

const notify = ({ sock, channel, notification, recipients }) => {
  const sdMessage = format({ channel, sdMessage: sdMessageOf(channel, notification) })
  return signal.broadcastMessage(sock, recipients, sdMessage)
}

// { Channel, string, string, string, string } -> string
const format = ({ channel, sdMessage, messageType, command, language }) => {
  const prefix = resolvePrefix(channel, messageType, command, language)
  return { ...sdMessage, messageBody: `${prefix}${sdMessage.messageBody}` }
}

// Channel, string, string, string -> string
const resolvePrefix = (channel, messageType, command, language) => {
  const prefixes = messagesIn(language).prefixes
  if (command === commands.RENAME || command === commands.INFO || command === commands.HELP) {
    // RENAME messages must provide their own header (b/c channel name changed since last query)
    // INFO & HELP messages provide their own prefixes
    return ''
  }
  if (messageType === BROADCAST_RESPONSE) {
    // subscriber responses get a special header so they don't look like broadcast messages from admins
    // we clone message to preserve attachments
    return `[${prefixes.broadcastResponse}]\n`
  }
  // base formatting for broadcast messages;  we clone sdMessage to preserve attachements
  return `[${channel.name}]\n`
}

const countBroacast = ({ db, channel }) =>
  // TODO(@zig): add prometheus counter increment here
  messageCountRepository.incrementBroadcastCount(
    db,
    channel.phoneNumber,
    channel.subscriptions.length,
  )

const countCommand = ({ db, channel }) =>
  // TODO(@zig): add prometheus counter increment here
  messageCountRepository.incrementCommandCount(db, channel.phoneNumber)

module.exports = {
  messageTypes,
  /**********/
  broadcast,
  dispatch,
  format,
  parseMessageType,
  respond,
  notify,
}
