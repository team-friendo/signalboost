const signal = require('./signal')
const messages = require('./messages')
const { commands, statuses } = require('./executor')
const messageCountRepository = require('../../db/repositories/messageCount')

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  const { command, status } = commandResult
  const isBroadcastMessage = status === statuses.NOOP
  return isBroadcastMessage
    ? dispatchable.sender.isAdmin
      ? broadcast(dispatchable)
      : respond({ ...dispatchable, message: messages.unauthorized, status: statuses.UNAUTHORIZED })
    : respond({ ...dispatchable, message: commandResult.message, command, status })
}

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

module.exports = { messages, dispatch, broadcast, respond, format }
