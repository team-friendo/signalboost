const signal = require('./signal')
const messages = require('./messages')
const { statuses } = require('./executor')
const messageCountRepository = require('../../db/repositories/messageCount')

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async (commandResult, dispatchable) => {
  const isBroadcastMessage = commandResult.status === statuses.NOOP
  return isBroadcastMessage
    ? dispatchable.sender.isAdmin
      ? broadcast(dispatchable)
      : respond({ ...dispatchable, message: messages.notAdmin })
    : respond({ ...dispatchable, message: commandResult.message })
}

// Dispatchable -> Promise<voic>
const broadcast = async ({ db, iface, channel, message, attachments }) => {
  const recipients = channel.subscriptions.map(s => s.humanPhoneNumber)
  return signal
    .sendMessage(iface, prefix(channel, message), recipients, attachments)
    .then(() => countBroacast({ db, channel }))
}

// (DbusInterface, string, Sender) -> Promise<void>
const respond = ({ db, iface, channel, message, sender }) =>
  signal
    .sendMessage(iface, prefix(channel, message), [sender.phoneNumber])
    .then(() => countCommand({ db, channel }))

// TODO: return command from command result, don't prefix if `RENAME` to avoid this `[NOPREFIX]` hack
// string -> string
const prefix = (channel, message) =>
  message.match(/^\[NOPREFIX\]/)
    ? message.replace('[NOPREFIX]', '')
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

module.exports = { messages, dispatch, broadcast, respond, prefix }
