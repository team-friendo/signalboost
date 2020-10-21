const signal = require('../signal')
const channelRepository = require('../db/repositories/channel')
const messageCountRepository = require('../db/repositories/messageCount')
const { sdMessageOf } = require('../signal/constants')
const { values, isEmpty } = require('lodash')
const { commands } = require('./commands/constants')
const { statuses } = require('../util')
const { wait, sequence } = require('../util')
const { loggerOf } = require('../util')
const logger = loggerOf('messenger')
const metrics = require('../metrics')
const { counters } = metrics
const {
  signal: { setExpiryInterval, attachmentSendDelay },
} = require('../config')

/**
 * type MessageType = 'BROADCAST_MESSAGE' | 'HOTLINE_MESSAGE' | 'COMMAND'
 */

const messageTypes = {
  BROADCAST_MESSAGE: 'BROADCAST_MESSAGE',
  HOTLINE_MESSAGE: 'HOTLINE_MESSAGE',
  COMMAND: 'COMMAND',
}

const { BROADCAST_MESSAGE, HOTLINE_MESSAGE, COMMAND } = messageTypes

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  const messageType = parseMessageType(commandResult)
  const channelPhoneNumber = dispatchable.channel.phoneNumber

  switch (messageType) {
    case BROADCAST_MESSAGE:
      metrics.incrementCounter(counters.SIGNALBOOST_MESSAGES, [
        channelPhoneNumber,
        BROADCAST_MESSAGE,
        null,
      ])
      return broadcast({ commandResult, dispatchable })
    case HOTLINE_MESSAGE:
      metrics.incrementCounter(counters.SIGNALBOOST_MESSAGES, [
        channelPhoneNumber,
        HOTLINE_MESSAGE,
        null,
      ])
      return handleHotlineMessage({ commandResult, dispatchable })
    case COMMAND:
      metrics.incrementCounter(counters.SIGNALBOOST_MESSAGES, [
        channelPhoneNumber,
        COMMAND,
        commandResult.command,
      ])
      return handleCommandResult({ commandResult, dispatchable })
    default:
      return Promise.reject(`Invalid message. Must be one of: ${values(messageTypes)}`)
  }
}

// (CommandResult, Dispatchable) -> MessageType
const parseMessageType = ({ command, status }) => {
  if (command === commands.NONE && status === statuses.SUCCESS) return HOTLINE_MESSAGE
  if (command === commands.BROADCAST && status === statuses.SUCCESS) return BROADCAST_MESSAGE

  return COMMAND
}

const handleHotlineMessage = async ({ commandResult, dispatchable }) => {
  await handleCommandResult({ commandResult, dispatchable })
  return messageCountRepository.countHotline(dispatchable.channel)
}

const handleCommandResult = async ({ commandResult, dispatchable }) => {
  const { command, message, notifications, status } = commandResult
  // We don't respond to REPLY or PRIVATE commands b/c their senders receive notifications instead.
  // Rationale: these commands are more like relayable messages than they are actual commands.
  const relayableException =
    (command === commands.REPLY && status === statuses.SUCCESS) ||
    (command === commands.PRIVATE && status === statuses.SUCCESS)

  if (!relayableException) await respond({ ...dispatchable, message, command, status })

  if (status === statuses.SUCCESS) await sendNotifications(dispatchable.channel, notifications)
  await wait(setExpiryInterval) // to ensure welcome notification arrives first
  await setExpiryTimeForNewUsers({ commandResult, dispatchable })
  return Promise.resolve()
}

/************
 * SENDING
 ************/

// Dispatchable -> Promise<MessageCount>
const broadcast = async ({ commandResult, dispatchable }) => {
  const { channel, sdMessage } = dispatchable
  const { notifications } = commandResult

  try {
    const delay = isEmpty(sdMessage.attachments) ? 0 : attachmentSendDelay
    await sendNotifications(channel, notifications, delay)
    return messageCountRepository.countBroadcast(channel)
  } catch (e) {
    logger.error(e)
  }
}

// (Database, Socket, Channel, string, Sender) -> Promise<void>
const respond = ({ channel, message, sender, command }) => {
  // because respond doesn't handle attachments, don't want to repeat message here
  return signal
    .sendMessage(
      sdMessageOf({ sender: channel.phoneNumber, recipient: sender.phoneNumber, message }),
      channel.socketId,
    )
    .then(async () => {
      // Don't count INFO commands from sysadmins. Why?
      // Sysadmins ping channels with INFO as an informal health checks very frequently.
      // Counting these pings would prevent us from detecting stale channels for recycling, which
      // we currently accomplish by looking for old timestamps in `channel.messageCounts.updatedAt`.
      const shouldCount = !(
        command === commands.INFO && (await channelRepository.isMaintainer(sender.phoneNumber))
      )
      return shouldCount && messageCountRepository.countCommand(channel)
    })
}

// ({ CommandResult, Dispatchable )) -> Promise<Array<string>>
const sendNotifications = (channel, notifications, delay = 0) => {
  // NOTE: we would prefer to send batched messages in parallel, but send them in sequence
  // to work around concurrency bugs in signald that cause significant lags / crashes
  // when trying to handle messages sent in parallel. At such time as we fix those bugs
  // we would like to call `Promise.all` here and launch all the writes at once!
  return sequence(
    notifications.map(({ recipient, message, attachments = [] }) => () =>
      signal.sendMessage(
        sdMessageOf({ sender: channel.phoneNumber, recipient, message, attachments }),
        channel.socketId,
      ),
    ),
    delay,
  )
}

// ({ Channel, Notification }) -> Promise<void>
// ({ CommandResult, Dispatchable }) -> Promise<void>
const setExpiryTimeForNewUsers = async ({ commandResult, dispatchable }) => {
  // for newly added users, make sure disappearing message timer
  // is set to channel's default expiry time
  const { command, payload, status } = commandResult
  const { channel, sender } = dispatchable

  if (status !== statuses.SUCCESS) return Promise.resolve()

  //TODO(aguestuser|2020-10-08):
  // - this is the ONLY path in which we use the `payload` field on the `CommandResult` returns from `processCommands`
  // - perhaps we can think of a different way to recover the e164 numbers here and drop `payload` from `CommandResult`?
  switch (command) {
    case commands.ADD:
      // in ADD case, payload is an e164 phone number
      // must be e164, else parse step would have failed and cmd could not have executed successfully
      return signal.setExpiration(channel.phoneNumber, payload, channel.messageExpiryTime)
    case commands.INVITE:
      // in INVITE case, payload is an array of e164 phone numbers (must be e164 for same reasons as ADD above)
      return Promise.all(
        payload.map(memberPhoneNumber =>
          signal.setExpiration(channel.phoneNumber, memberPhoneNumber, channel.messageExpiryTime),
        ),
      )
    case commands.JOIN:
    case commands.ACCEPT:
      return signal.setExpiration(
        channel.phoneNumber,
        sender.phoneNumber,
        channel.messageExpiryTime,
      )
    default:
      return Promise.resolve()
  }
}

module.exports = {
  messageTypes,
  /**********/
  broadcast,
  sendNotifications,
  dispatch,
  parseMessageType,
  respond,
}
