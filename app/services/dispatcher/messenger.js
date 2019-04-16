const { isEmpty } = require('lodash')
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
  NEW_ADMIN: 'NEW_ADMIN',
}

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
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
  isNewAdmin({ command, status }) ? notificationTypes.NEW_ADMIN : null

const isNewAdmin = ({ command, status }) => command === commands.ADD && status === statuses.SUCCESS

const handleBroadcast = dispatchable =>
  dispatchable.sender.isAdmin
    ? broadcast(dispatchable)
    : respond({ ...dispatchable, message: messages.unauthorized, status: statuses.UNAUTHORIZED })

const handleResponse = ({ commandResult, dispatchable }) => {
  const { message, command, status } = commandResult
  return respond({ ...dispatchable, message, command, status })
}

const handleNotification = ({ dispatchable, commandResult, notificationType }) =>
  ({
    // TODO: extend to handle other notifiable command results
    [notificationTypes.NEW_ADMIN]: () => handleNewAdmin({ dispatchable, commandResult }),
  }[notificationType]())

const handleNewAdmin = ({ dispatchable, commandResult }) => {
  const { command, status, message, payload } = commandResult
  const { channel, sender } = dispatchable
  const notification = messages.notifications.welcome(channel, sender.phoneNumber)
  const recipients = [payload]
  return Promise.all([
    respond({ ...dispatchable, message, command, status }),
    notify({ ...dispatchable, notification, recipients }).then(() =>
      channelRepository.createWelcome(dispatchable.db, channel.phoneNumber, payload),
    ),
  ])
}

/************
 * SENDING
 ************/

// Dispatchable -> Promise<void>
const broadcast = async ({ db, iface, channel, message, attachments }) => {
  const recipients = channel.subscriptions.map(s => s.humanPhoneNumber)
  return signal
    .sendMessage(iface, format(channel, message), recipients, attachments)
    .then(() => countBroacast({ db, channel }))
}

// (DbusInterface, string, Sender) -> Promise<void>
const respond = ({ db, iface, channel, message, sender, command, status }) => {
  const formattedMessage = format(channel, message, command, status)
  return signal
    .sendMessage(iface, formattedMessage, [sender.phoneNumber])
    .then(() => countCommand({ db, channel }))
}

const notify = ({ db, iface, channel, notification, recipients }) =>
  signal
    .sendMessage(iface, format(channel, notification), recipients)
    .then(() => countCommand({ db, channel }))

// string -> string
const format = (channel, message, command, status) =>
  status === statuses.UNAUTHORIZED || command === commands.RENAME
    ? message
    : `[${channel.name}]\n${message}`

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
  notificationTypes,
  parseMessageType,
  dispatch,
  broadcast,
  respond,
  format,
}
