const signal = require('../signal')
const messages = require('./messages')
const { values } = require('lodash')
const { commands, statuses } = require('./executor')
const messageCountRepository = require('../../db/repositories/messageCount')

/**
 * type MessageType = 'BROADCAST' | 'RESPONSE' | 'NOTIFICATION'
 */

const messageTypes = {
  BROADCAST: 'BROADCAST',
  RESPONSE: 'RESPONSE',
  NOTIFY_NEW_PUBLISHER: 'NEW_PUBLISHER',
}

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  const messageType = parseMessageType(commandResult)
  switch (messageType) {
    case messageTypes.BROADCAST:
      return handleBroadcast(dispatchable)
    case messageTypes.RESPONSE:
      return handleResponse({ commandResult, dispatchable })
    case messageTypes.NOTIFY_NEW_PUBLISHER:
      return handleNotification({ commandResult, dispatchable, messageType })
    default:
      return Promise.reject(`Invalid message. Must be one of: ${values(messageTypes)}`)
  }
}

// CommandResult -> [MessageType, NotificationType]
const parseMessageType = commandResult => {
  if (commandResult.status === statuses.NOOP) return messageTypes.BROADCAST
  else if (isNewPublisher(commandResult)) return messageTypes.NOTIFY_NEW_PUBLISHER
  else return messageTypes.RESPONSE
}

const isNewPublisher = ({ command, status }) =>
  command === commands.ADD && status === statuses.SUCCESS

const handleBroadcast = dispatchable =>
  dispatchable.sender.isPublisher
    ? broadcast(dispatchable)
    : respond({
        ...dispatchable,
        message: messages.unauthorized,
        status: statuses.UNAUTHORIZED,
      })

const handleResponse = ({ commandResult, dispatchable }) => {
  const { message, command, status } = commandResult
  return respond({ ...dispatchable, message, command, status })
}

const handleNotification = ({ commandResult, dispatchable, messageType }) => {
  const [cr, d] = [commandResult, dispatchable]
  return Promise.all([
    handleResponse({ commandResult, dispatchable }),
    {
      // TODO: extend to handle other notifiable command results
      [messageTypes.NOTIFY_NEW_PUBLISHER]: () =>
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
    notification: messages.notifications.welcome(channel, addingPublisher),
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

// (DbusInterface, string, Sender) -> Promise<void>
const respond = ({ db, sock, channel, message, sender, command, status }) => {
  const sdMessage = format(channel, sdMessageOf(channel, message), command, status)
  return signal
    .sendMessage(sock, sender.phoneNumber, sdMessage)
    .then(() => countCommand({ db, channel }))
}

const notify = ({ db, sock, channel, notification, recipients }) => {
  const sdMessage = format(channel, sdMessageOf(channel, notification))
  return signal
    .broadcastMessage(sock, recipients, sdMessage)
    .then(() => countCommand({ db, channel }))
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
