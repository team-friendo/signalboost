const signal = require('../signal')
const { messagesIn } = require('./strings/messages')
const { sdMessageOf } = require('../signal')
const { memberTypes } = require('../../db/repositories/membership')
const { values } = require('lodash')
const { commands, statuses } = require('./commands/constants')
const channelRepository = require('../../db/repositories/channel')
const { getAdminPhoneNumbers } = channelRepository
const messageCountRepository = require('../../db/repositories/messageCount')
const { wait } = require('../util')
const {
  defaultLanguage,
  signal: { signupPhoneNumber, resendDelay },
} = require('../../config')

/**
 * type MessageType = 'BROADCAST_MESSAGE' | 'COMMAND_RESULT' | 'NOTIFICATION'
 */

const messageTypes = {
  BROADCAST_MESSAGE: 'BROADCAST_MESSAGE',
  HOTLINE_MESSAGE: 'HOTLINE_MESSAGE',
  COMMAND_RESULT: 'COMMAND_RESULT',
  NEW_ADMIN_WELCOME: 'NEW_ADMIN_WELCOME',
  SIGNUP_MESSAGE: 'SIGNUP_MESSAGE',
}

const { BROADCAST_MESSAGE, HOTLINE_MESSAGE, COMMAND_RESULT, SIGNUP_MESSAGE } = messageTypes

const { ADMIN } = memberTypes

/***************
 * DISPATCHING
 ***************/

// (CommandResult, Dispatchable) -> Promise<void>
const dispatch = async ({ commandResult, dispatchable }) => {
  const messageType = parseMessageType(commandResult, dispatchable)
  switch (messageType) {
    case BROADCAST_MESSAGE:
      return broadcast(dispatchable)
    case HOTLINE_MESSAGE:
      return handleHotlineMessage(dispatchable)
    case COMMAND_RESULT:
      return handleCommandResult({ commandResult, dispatchable })
    case SIGNUP_MESSAGE:
      return handleSignupMessage(dispatchable)
    default:
      return Promise.reject(`Invalid message. Must be one of: ${values(messageTypes)}`)
  }
}

// (CommandResult, Dispatchable) -> MessageType
const parseMessageType = (commandResult, { sender, channel }) => {
  if (commandResult.status === statuses.NOOP) {
    if (sender.type === ADMIN) return BROADCAST_MESSAGE
    if (channel.phoneNumber === signupPhoneNumber) return SIGNUP_MESSAGE
    return HOTLINE_MESSAGE
  }
  return COMMAND_RESULT
}

const handleSignupMessage = async ({ sock, channel, sender, sdMessage }) => {
  const notifications = messagesIn(defaultLanguage).notifications
  // TODO(aguestuser|2019-11-09): send this as a disappearing message?
  // notify admins of signup request
  await notify({
    sock,
    channel,
    notification: notifications.signupRequestReceived(sender.phoneNumber, sdMessage.messageBody),
    recipients: channelRepository.getAdminPhoneNumbers(channel),
  })
  // respond to signup requester
  return notify({
    sock,
    channel,
    notification: notifications.signupRequestResponse,
    recipients: [sender.phoneNumber],
  })
}

const handleHotlineMessage = dispatchable => {
  const {
    channel: { responsesEnabled },
    sender: { language, type },
  } = dispatchable
  const disabledMessage = messagesIn(language).notifications.hotlineMessagesDisabled(
    type === memberTypes.SUBSCRIBER,
  )
  return responsesEnabled
    ? relayHotlineMessage(dispatchable)
    : respond({ ...dispatchable, status: statuses.UNAUTHORIZED, message: disabledMessage })
}

const handleCommandResult = async ({ commandResult, dispatchable }) => {
  const { command, message, status } = commandResult
  await respond({ ...dispatchable, message, command, status })
  await wait(resendDelay)
  return handleNotifications({ commandResult, dispatchable })
}

// ({ CommandResult, Dispatchable )) -> SignalboostStatus
const handleNotifications = async ({ commandResult, dispatchable }) => {
  const { command, status } = commandResult
  const { db, sock, channel, sender } = dispatchable
  const notifyBase = { db, sock, channel }
  // TODO(aguestuser|2019-12-08):
  //  once if/else branch logic has all been moved into new format
  //  - return this Promise.all
  //  - update the signature of `notify` to
  //    - take one recipient, *not* many recipients
  //    - call signal.sendMessage *not* broadcastMessage
  //    - don't call `format` (to add msg header) in `notify` anymore (?)
  await Promise.all(
    commandResult.notifications.map(notification =>
      notify({
        ...notifyBase,
        notification: notification.message,
        recipients: [notification.recipient],
      }),
    ),
  )

  if (command === commands.INVITE && status === statuses.SUCCESS) {
    // welcome new admin
    return notify({
      ...notifyBase,
      notification: messagesIn(defaultLanguage).notifications.inviteReceived(channel.name),
      recipients: [payload],
    })
  }
}

/************
 * SENDING
 ************/

// Dispatchable -> Promise<void>
const broadcast = async ({ db, sock, channel, sdMessage }) => {
  const recipients = channel.memberships.map(m => m.memberPhoneNumber)
  return signal
    .broadcastMessage(sock, recipients, addHeader({ channel, sdMessage }))
    .then(() => countBroacast({ db, channel }))
}

// Dispatchable -> Promise<void>
const relayHotlineMessage = async ({ db, sock, channel, sender, sdMessage }) => {
  const { language } = sender
  const recipients = channelRepository.getAdminPhoneNumbers(channel)
  const notification = messagesIn(language).notifications.hotlineMessageSent(channel)
  const outMessage = addHeader({ channel, sdMessage, messageType: HOTLINE_MESSAGE, language })
  return signal
    .broadcastMessage(sock, recipients, outMessage)
    .then(() => countBroacast({ db, channel }))
    .then(() => respond({ db, sock, channel, sender, message: notification }))
}

// (DbusInterface, string, Sender, string?, string?) -> Promise<void>
const respond = ({ db, sock, channel, message, sender }) => {
  return signal
    .sendMessage(sock, sender.phoneNumber, sdMessageOf(channel, message))
    .then(() => countCommand({ db, channel }))
}

const notify = ({ sock, channel, notification, recipients }) =>
  signal.broadcastMessage(sock, recipients, sdMessageOf(channel, notification))

/**********
 * HELPERS
 **********/

// { Channel, string, string, string, string } -> string
const addHeader = ({ channel, sdMessage, messageType, language }) => {
  const prefix =
    messageType === HOTLINE_MESSAGE
      ? `[${messagesIn(language).prefixes.hotlineMessage}]\n`
      : `[${channel.name}]\n`
  return { ...sdMessage, messageBody: `${prefix}${sdMessage.messageBody}` }
}

const countBroacast = ({ db, channel }) =>
  // TODO(@zig): add prometheus counter increment here
  messageCountRepository.incrementBroadcastCount(
    db,
    channel.phoneNumber,
    channel.memberships.length,
  )

const countCommand = ({ db, channel }) =>
  // TODO(@zig): add prometheus counter increment here
  messageCountRepository.incrementCommandCount(db, channel.phoneNumber)

module.exports = {
  messageTypes,
  /**********/
  broadcast,
  dispatch,
  addHeader,
  parseMessageType,
  respond,
  notify,
}
