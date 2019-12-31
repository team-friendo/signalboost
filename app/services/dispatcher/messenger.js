const validator = require('../../db/validations/phoneNumber')
const signal = require('../signal')
const channelRepository = require('../../db/repositories/channel')
const messageCountRepository = require('../../db/repositories/messageCount')
const { parseExecutable } = require('./commands/parse')
const { messagesIn } = require('./strings/messages')
const { sdMessageOf } = require('../signal')
const { memberTypes } = require('../../db/repositories/membership')
const { values } = require('lodash')
const { commands, statuses } = require('./commands/constants')
const {
  defaultLanguage,
  signal: { signupPhoneNumber },
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
  const notificationMessages = messagesIn(defaultLanguage).notifications
  const adminPhoneNumbers = channelRepository.getAdminPhoneNumbers(channel)
  // TODO(aguestuser|2019-11-09): send this as a disappearing message?
  // notify admins of signup request
  await Promise.all(
    adminPhoneNumbers.map(adminPhoneNumber => {
      notify({
        sock,
        channel,
        notification: {
          recipient: adminPhoneNumber,
          message: notificationMessages.signupRequestReceived(
            sender.phoneNumber,
            sdMessage.messageBody,
          ),
        },
      })
    }),
  )
  // respond to signup requester
  return notify({
    sock,
    channel,
    notification: {
      message: notificationMessages.signupRequestResponse,
      recipient: sender.phoneNumber,
    },
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
  await setExpiryTimeForNewUsers({ commandResult, dispatchable })
  await respond({ ...dispatchable, message, command, status })
  // await wait(resendDelay) // not sure we need this...(if so it would be for re-adding admins after safety # change)
  return handleNotifications({ commandResult, dispatchable })
}

// ({ CommandResult, Dispatchable )) -> Promise<SignalboostStatus>
const handleNotifications = ({ commandResult, dispatchable }) => {
  const { sock, channel } = dispatchable
  const { status, notifications } = commandResult

  return status === statuses.SUCCESS
    ? Promise.all(notifications.map(notification => notify({ sock, channel, notification })))
    : Promise.resolve([])
}

/************
 * SENDING
 ************/

// ({ CommandResult, Dispatchable }) -> Promise<void>
const setExpiryTimeForNewUsers = ({ commandResult, dispatchable }) => {
  // for newly added users, make sure disappearing message timer
  // is set to channel's default expiry time
  const { command, status, payload } = commandResult
  const { sock, channel, sender } = dispatchable

  if (status !== statuses.SUCCESS) return Promise.resolve()
  switch (command) {
    case commands.ADD:
    case commands.INVITE:
      /*eslint no-case-declarations: 0*/

      // we know we can always successfully parse an e164-formatted phone number from JOIN or ACCEPT
      // here because the command succeeded (if parsing failed, the command would have failed)

      // TODO(aguestuser|2019-12-31):
      //  eventually, we want to pull phone number validation into `commands.parse`
      //  at which point, the payload will already be e164-formatted and we can make the above a one-liner

      const rawPhoneNumber = parseExecutable(dispatchable.sdMessage.messageBody).payload
      const newMemberPhoneNumber = validator.parseValidPhoneNumber(rawPhoneNumber).phoneNumber
      return signal.setExpiration(
        sock,
        channel.phoneNumber,
        newMemberPhoneNumber,
        channel.messageExpiryTime,
      )
    case commands.JOIN:
    case commands.ACCEPT:
      return signal.setExpiration(
        sock,
        channel.phoneNumber,
        sender.phoneNumber,
        channel.messageExpiryTime,
      )
    default:
      return Promise.resolve()
  }
}

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

// (Socket, Channel, Notification) -> Promise<void>
const notify = ({ sock, channel, notification }) =>
  signal.sendMessage(sock, notification.recipient, sdMessageOf(channel, notification.message))

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
