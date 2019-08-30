const signal = require('../signal')
const messages = require('./messages')
const { notifications } = messages
const { values } = require('lodash')
const { commands, statuses } = require('./executor')
const messageCountRepository = require('../../db/repositories/messageCount')

/**
 * type MessageType = 'BROADCAST_MESSAGE' | 'COMMAND_RESPONSE' | 'NOTIFICATION'
 */

const messageTypes = {
  BROADCAST_MESSAGE: 'BROADCAST_MESSAGE',
  COMMAND_RESPONSE: 'COMMAND_RESPONSE',
  NEW_PUBLISHER_WELCOME: 'NEW_PUBLISHER_WELCOME',
}

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  const messageType = parseMessageType(commandResult)
  switch (messageType) {
    case messageTypes.BROADCAST_MESSAGE:
      return handleBroadcastMessage(dispatchable)
    case messageTypes.COMMAND_RESPONSE:
      return handleComandResponse({ commandResult, dispatchable })
    case messageTypes.NEW_PUBLISHER_WELCOME:
      return handleNotification({ commandResult, dispatchable, messageType })
    default:
      return Promise.reject(`Invalid message. Must be one of: ${values(messageTypes)}`)
  }
}

// CommandResult -> [MessageType, NotificationType]
const parseMessageType = commandResult => {
  if (commandResult.status === statuses.NOOP) return messageTypes.BROADCAST_MESSAGE
  else if (isNewPublisher(commandResult)) return messageTypes.NEW_PUBLISHER_WELCOME
  else return messageTypes.COMMAND_RESPONSE
}

const isNewPublisher = ({ command, status }) =>
  command === commands.ADD && status === statuses.SUCCESS

const handleBroadcastMessage = dispatchable => {
  if (dispatchable.sender.isPublisher) {
    return broadcast(dispatchable)
  }
  if (dispatchable.sender.isSubscriber && dispatchable.channel.responsesEnabled) {
    return relayBroadcastResponse(dispatchable)
  }
  return respond({
    ...dispatchable,
    message: notifications.unauthorized,
    status: statuses.UNAUTHORIZED,
  })
}

// TODO: rename this handleCommandResult
const handleComandResponse = ({ commandResult, dispatchable }) => {
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
    handleComandResponse({ commandResult, dispatchable }),
    {
      // TODO: extend to handle other notifiable command results
      [messageTypes.NEW_PUBLISHER_WELCOME]: () =>
        welcomeNewPublisher({
          db: d.db,
          sock: d.sock,
          channel: d.channel,
          newPublisher: cr.payload,
          addingPublisher: d.sender.phoneNumber,
        }),
    }[messageType](),
  ])
}

// { Database, Channel, string, string } => Promise<void>
const welcomeNewPublisher = ({ db, sock, channel, newPublisher, addingPublisher }) =>
  notify({
    db,
    sock,
    channel,
    notification: notifications.welcome(channel, addingPublisher),
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
    .broadcastMessage(sock, recipients, format(channel, sdMessage))
    .then(() => countBroacast({ db, channel }))
}

// Dispatchable -> Promise<void>
const relayBroadcastResponse = async ({ db, sock, channel, sdMessage, sender }) => {
  const recipients = channel.publications.map(p => p.publisherPhoneNumber)
  const notice = notifications.broadcastResponseSent(channel)
  return signal
    .broadcastMessage(sock, recipients, sdMessage)
    .then(() => countBroacast({ db, channel }))
    .then(() => respond({ db, sock, channel, sender, message: notice }))
}

// (DbusInterface, string, Sender, string?, string?) -> Promise<void>
const respond = ({ db, sock, channel, message, sender, command, status }) => {
  const sdMessage = format(channel, sdMessageOf(channel, message), command, status)
  return signal
    .sendMessage(sock, sender.phoneNumber, sdMessage)
    .then(() => countCommand({ db, channel }))
}

const notify = ({ sock, channel, notification, recipients }) => {
  const sdMessage = format(channel, sdMessageOf(channel, notification))
  return signal.broadcastMessage(sock, recipients, sdMessage)
}

// string -> string
const format = (channel, message, command, status) =>
  // (1) Don't leak the channel name to non-subscribers
  // (2) RENAME messages must provide their own header (b/c the channel name changed since it was queried)
  status === statuses.UNAUTHORIZED || command === commands.RENAME
    ? message
    : { ...message, messageBody: `[${channel.name}]\n${message.messageBody}` }

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
  type: signal.messageTypes.SEND,
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
