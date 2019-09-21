const { senderTypes } = require('../../constants')
const signal = require('../signal')
const { messagesIn } = require('./messages')
const { values } = require('lodash')
const { commands, statuses } = require('./executor')
const messageCountRepository = require('../../db/repositories/messageCount')

/**
 * type MessageType = 'BROADCAST_MESSAGE' | 'COMMAND_RESULT' | 'NOTIFICATION'
 */

const messageTypes = {
  BROADCAST_MESSAGE: 'BROADCAST_MESSAGE',
  BROADCAST_RESPONSE: 'BROADCAST_RESPONSE',
  COMMAND_RESULT: 'COMMAND_RESULT',
  NEW_PUBLISHER_WELCOME: 'NEW_PUBLISHER_WELCOME',
}

const {
  BROADCAST_MESSAGE,
  BROADCAST_RESPONSE,
  COMMAND_RESULT,
  NEW_PUBLISHER_WELCOME,
} = messageTypes

const { PUBLISHER } = senderTypes

const sdMessageTypes = signal.messageTypes

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  const messageType = parseMessageType(commandResult, dispatchable.sender)
  switch (messageType) {
    case BROADCAST_MESSAGE:
      return broadcast(dispatchable)
    case BROADCAST_RESPONSE:
      return handleBroadcastResponse(dispatchable)
    case COMMAND_RESULT:
      return handleCommandResult({ commandResult, dispatchable })
    case NEW_PUBLISHER_WELCOME:
      return handleNotification({ commandResult, dispatchable, messageType })
    default:
      return Promise.reject(`Invalid message. Must be one of: ${values(messageTypes)}`)
  }
}

// CommandResult -> [MessageType, NotificationType]
const parseMessageType = (commandResult, sender) => {
  if (commandResult.status === statuses.NOOP) {
    return sender.type === PUBLISHER ? BROADCAST_MESSAGE : BROADCAST_RESPONSE
  } else if (isNewPublisher(commandResult)) return NEW_PUBLISHER_WELCOME
  else return COMMAND_RESULT
}

const isNewPublisher = ({ command, status }) =>
  command === commands.ADD && status === statuses.SUCCESS

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

// TODO: rename this handleCommandResult
const handleCommandResult = ({ commandResult, dispatchable }) => {
  const { message, command, status } = commandResult
  // TODO: respond to sender, notify all other publishers
  //  - exclude: HELP/INFO
  //  - (implicitly) include: RENAME/RESPONSES/ADD/JOIN/LEAVE (don't include phone numbers in join/leave)
  //  - add publisher phone numbers for RENAME/ADD/REMOVE/RESPONSES
  return respond({ ...dispatchable, message, command, status })
}

const handleNotification = ({ commandResult, dispatchable, messageType }) => {
  const [cr, d] = [commandResult, dispatchable]
  return Promise.all([
    handleCommandResult({ commandResult, dispatchable }),
    {
      // TODO: extend to handle other notifiable command results
      [NEW_PUBLISHER_WELCOME]: () =>
        welcomeNewPublisher({
          db: d.db,
          sock: d.sock,
          channel: d.channel,
          newPublisher: cr.payload,
          addingPublisher: d.sender.phoneNumber,
          language: d.sender.language,
        }),
    }[messageType](),
  ])
}

// { Database, Channel, string, string } => Promise<void>
const welcomeNewPublisher = ({ db, sock, channel, newPublisher, addingPublisher, language }) =>
  notify({
    db,
    sock,
    channel,
    notification: messagesIn(language).notifications.welcome(channel, addingPublisher),
    recipients: [newPublisher],
  })

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
  if (command === commands.RENAME || command === commands.INFO) {
    // RENAME messages must provide their own header (b/c channel name changed since last query)
    // INFO messages don't need a name prefix b/c they provide channel name as part of message
    return ''
  }
  if (command === commands.HELP) {
    // HELP responses flag that they contain commands instead of listing channel name
    return `[${prefixes.helpResponse}]\n`
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

const sdMessageOf = (channel, messageBody) => ({
  type: sdMessageTypes.SEND,
  username: channel.phoneNumber,
  messageBody,
})

module.exports = {
  messageTypes,
  /**********/
  broadcast,
  dispatch,
  format,
  parseMessageType,
  respond,
  sdMessageOf,
  welcomeNewPublisher,
}
