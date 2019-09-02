const signal = require('../signal')
const messages = require('./messages')
const { notifications } = messages
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

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  const messageType = parseMessageType(commandResult, dispatchable.sender)
  switch (messageType) {
    case messageTypes.BROADCAST_MESSAGE:
      return broadcast(dispatchable)
    case messageTypes.BROADCAST_RESPONSE:
      return handleBroadcastResponse(dispatchable)
    case messageTypes.COMMAND_RESULT:
      return handleCommandResult({ commandResult, dispatchable })
    case messageTypes.NEW_PUBLISHER_WELCOME:
      return handleNotification({ commandResult, dispatchable, messageType })
    default:
      return Promise.reject(`Invalid message. Must be one of: ${values(messageTypes)}`)
  }
}

// CommandResult -> [MessageType, NotificationType]
const parseMessageType = (commandResult, sender) => {
  if (commandResult.status === statuses.NOOP) {
    return sender.isPublisher ? messageTypes.BROADCAST_MESSAGE : messageTypes.BROADCAST_RESPONSE
  } else if (isNewPublisher(commandResult)) return messageTypes.NEW_PUBLISHER_WELCOME
  else return messageTypes.COMMAND_RESULT
}

const isNewPublisher = ({ command, status }) =>
  command === commands.ADD && status === statuses.SUCCESS

const handleBroadcastResponse = dispatchable => {
  // TODO(aguestuser|2019-09-02):
  //  this allows anyone to respond. consider only allowing responses from subscribers
  if (!dispatchable.channel.responsesEnabled) {
    return respond({
      ...dispatchable,
      message: notifications.unauthorized,
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
    .broadcastMessage(sock, recipients, format({ channel, sdMessage }))
    .then(() => countBroacast({ db, channel }))
}

// Dispatchable -> Promise<void>
const relayBroadcastResponse = async ({ db, sock, channel, sender, sdMessage }) => {
  const recipients = channel.publications.map(p => p.publisherPhoneNumber)
  const senderNotification = notifications.broadcastResponseSent(channel)
  const messageType = messageTypes.BROADCAST_RESPONSE
  //console.log('====== sdMessage.messageBody\n', sdMessage.messageBody)
  return signal
    .broadcastMessage(sock, recipients, format({ channel, sdMessage, messageType }))
    .then(() => countBroacast({ db, channel }))
    .then(() => respond({ db, sock, channel, sender, message: senderNotification }))
}

// (DbusInterface, string, Sender, string?, string?) -> Promise<void>
const respond = ({ db, sock, channel, message, sender, command, status }) => {
  const sdMessage = format({ channel, messageBody: message, command, status })
  return signal
    .sendMessage(sock, sender.phoneNumber, sdMessage)
    .then(() => countCommand({ db, channel }))
}

const notify = ({ sock, channel, notification, recipients }) => {
  const sdMessage = format({ channel, messageBody: notification })
  return signal.broadcastMessage(sock, recipients, sdMessage)
}

// TODO(aguestuser|2018-08-31) this strikes me as poorly factored
// { Channel, string, string, string, string } -> string
const format = ({ channel, sdMessage, messageBody, messageType, command }) => {
  if (command === commands.RENAME) {
    // RENAME messages must provide their own header (b/c channel name changed since last query)
    return sdMessageOf(channel, messageBody)
  }
  if (command === commands.HELP) {
    // RENAME messages must provide their own header (b/c channel name changed since last query)
    return sdMessageOf(channel, `[${messages.prefixes.helpResponse}]\n${messageBody}`)
  }
  if (messageType === messageTypes.BROADCAST_RESPONSE) {
    // flag subscriber responses so they don't look like broadcast messages
    // throw out other fields on `sdMessage (like attachments)
    return sdMessageOf(
      channel,
      `[${messages.prefixes.broadcastResponse}]\n${sdMessage.messageBody}`,
    )
  }
  // clone sdMessage if passed in to preserve attachements
  const msg = sdMessage || sdMessageOf(channel, messageBody)
  return { ...msg, messageBody: `[${channel.name}]\n${msg.messageBody}` }
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
