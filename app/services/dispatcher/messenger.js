const signal = require('./signal')
const messages = require('./messages')
const { commands, statuses } = require('./executor')
const messageCountRepository = require('../../db/repositories/messageCount')
const channelRepository = require('../../db/repositories/channel')

/**
 * type MessageType = 'BROADCAST' | 'RESPONSE' | 'NOTIFICATION'
 */

const messageTypes = {
  BROADCAST: 'BROADCAST',
  RESPONSE: 'RESPONSE',
  NOTIFICATION: 'NOTIFICATION',
}

const notificationTypes = {
  NEW_PUBLISHER: 'NEW_PUBLISHER',
}

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  // TODO: parseMessageType should only parse a messageType. because... right?
  const [messageType, notificationType] = parseMessageType(commandResult)
  return {
    [messageTypes.BROADCAST]: () => handleBroadcast(dispatchable),
    [messageTypes.RESPONSE]: () => handleResponse({ commandResult, dispatchable }),
    [messageTypes.NOTIFICATION]: () =>
      handleNotification({ commandResult, dispatchable, notificationType }),
  }[messageType]()
}

// CommandResult -> [MessageType, NotificationType]
const parseMessageType = commandResult => {
  if (commandResult.status === statuses.NOOP) return [messageTypes.BROADCAST]
  else if (parseNotifiable(commandResult))
    return [messageTypes.NOTIFICATION, parseNotifiable(commandResult)]
  else return [messageTypes.RESPONSE]
}

const parseNotifiable = ({ command, status }) =>
  // TODO: extend to handle other notifiable command results
  isNewPublisher({ command, status }) ? notificationTypes.NEW_PUBLISHER : null

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
const handleNotification = ({ commandResult, dispatchable, notificationType }) => {
  const [cr, d] = [commandResult, dispatchable]
  return Promise.all([
    handleResponse({ commandResult, dispatchable }),
    {
      // TODO: extend to handle other notifiable command results
      [notificationTypes.NEW_PUBLISHER]: () =>
        welcomeNewPublisher({
          db: d.db,
          sock: d.sock,
          channel: d.channel,
          newPublisher: cr.payload,
          addingPublisher: d.sender.phoneNumber,
        }),
    }[notificationType](),
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
  notificationTypes,
  /**********/
  broadcast,
  dispatch,
  format,
  parseMessageType,
  respond,
  welcomeNewPublisher,
}
