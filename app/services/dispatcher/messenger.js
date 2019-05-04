const signal = require('./signal')
const messages = require('./messages')
const { values } = require('lodash')
const { commands, statuses } = require('./executor')
const messageCountRepository = require('../../db/repositories/messageCount')
const channelRepository = require('../../db/repositories/channel')

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
    : respond({ ...dispatchable, message: messages.unauthorized, status: statuses.UNAUTHORIZED })

const handleResponse = ({ commandResult, dispatchable }) => {
  const { messageBody, command, status } = commandResult
  return respond({ ...dispatchable, messageBody, command, status })
}

// TODO: move notification type parsing to here
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

// { Database, Channel, string, string } => Promise<WelcomeInstance>
const welcomeNewPublisher = ({ db, sock, channel, newPublisher, addingPublisher }) =>
  notify({
    db,
    sock,
    channel,
    notification: messages.notifications.welcome(channel, addingPublisher),
    recipients: [newPublisher],
  }).then(() => channelRepository.createWelcome(db, channel.phoneNumber, newPublisher))

/************
 * SENDING
 ************/

// Dispatchable -> Promise<void>
const broadcast = async ({ db, sock, channel, message }) => {
  const recipients = [
    ...channel.subscriptions.map(s => s.subscriberPhoneNumber),
    ...channel.publications.map(p => p.publisherPhoneNumber),
  ]
  return signal
    .broadcastMessage(sock, recipients, format(channel, message))
    .then(() => countBroacast({ db, channel }))
}

// (DbusInterface, string, Sender) -> Promise<void>
const respond = ({ db, sock, channel, messageBody, sender, command, status }) => {
  const message = format(
    channel,
    parseResponseMessage(channel, sender, messageBody),
    command,
    status,
  )
  return signal.sendMessage(sock, message).then(() => countCommand({ db, channel }))
}

const notify = ({ db, sock, channel, notification, recipients }) => {
  return signal
    .broadcastMessage(
      sock,
      recipients,
      format(channel, parseNotificationMessage(channel, notification)),
    )
    .then(() => countCommand({ db, channel }))
}

// string -> string
const format = (channel, message, command, status) =>
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

const parseResponseMessage = (channel, sender, messageBody) => ({
  type: signal.messageTypes.SEND,
  username: channel.phoneNumber,
  recipientNumber: sender.phoneNumber,
  messageBody,
})

const parseNotificationMessage = (channel, notification) => ({
  type: signal.messageTypes.SEND,
  username: channel.phoneNumber,
  messageBody: notification,
})

module.exports = {
  messageTypes,
  /**********/
  broadcast,
  dispatch,
  format,
  parseMessageType,
  respond,
  welcomeNewPublisher,
}
