const signal = require('./signal')
const messages = require('./messages')
const { statuses } = require('./executor')

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
const broadcast = async ({ iface, channel, message, attachments }) =>
  signal.sendMessage(
    iface,
    prefix(channel, message),
    channel.subscriptions.map(s => s.humanPhoneNumber),
    attachments,
  )

// (DbusInterface, string, Sender) -> Promise<void>
const respond = ({ iface, channel, message, sender }) =>
  signal.sendMessage(iface, prefix(channel, message), [sender.phoneNumber])

// TODO: return command from command result, don't prefix if `RENAME` to avoid this `[NOPREFIX]` hack
// string -> string
const prefix = (channel, message) =>
  message.match(/^\[NOPREFIX\]/)
    ? message.replace('[NOPREFIX]', '')
    : `[${channel.name}]\n${message}`

module.exports = { messages, dispatch, broadcast, respond, prefix }
