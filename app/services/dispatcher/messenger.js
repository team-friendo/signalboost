const validator = require('../../db/validations/phoneNumber')
const signal = require('../signal')
const channelRepository = require('../../db/repositories/channel')
const messageCountRepository = require('../../db/repositories/messageCount')
const { parseExecutable } = require('./commands/parse')
const { messagesIn } = require('./strings/messages')
const { sdMessageOf } = require('../signal')
const { memberTypes } = require('../../db/repositories/membership')
const { flatten, values } = require('lodash')
const { commands, statuses } = require('./commands/constants')
const { wait, sequence, batchesOfN } = require('../util')
const {
  defaultLanguage,
  signal: {
    signupPhoneNumber,
    defaultMessageExpiryTime,
    minResendInterval,
    broadcastBatchSize,
    broadcastBatchInterval,
  },
} = require('../../config')

/**
 * type MessageType = 'BROADCAST_MESSAGE' | 'HOTLINE_MESSAGE' | 'SIGNUP_MESSAGE' | 'COMMAND_RESULT'
 */

const messageTypes = {
  BROADCAST_MESSAGE: 'BROADCAST_MESSAGE',
  HOTLINE_MESSAGE: 'HOTLINE_MESSAGE',
  COMMAND_RESULT: 'COMMAND_RESULT',
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
    case SIGNUP_MESSAGE:
      return handleSignupMessage(dispatchable)
    case COMMAND_RESULT:
      return handleCommandResult({ commandResult, dispatchable })
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

const handleHotlineMessage = dispatchable => {
  const {
    channel: { hotlineOn },
    sender: { language, type },
  } = dispatchable
  const disabledMessage = messagesIn(language).notifications.hotlineMessagesDisabled(
    type === memberTypes.SUBSCRIBER,
  )
  return hotlineOn
    ? relayHotlineMessage(dispatchable)
    : respond({ ...dispatchable, status: statuses.UNAUTHORIZED, message: disabledMessage })
}

const handleSignupMessage = async ({ sock, channel, sender, sdMessage }) => {
  const notificationMessages = messagesIn(defaultLanguage).notifications
  const adminPhoneNumbers = channelRepository.getAdminPhoneNumbers(channel)
  // respond to signup requester
  await notify({
    sock,
    channel,
    notification: {
      message: notificationMessages.signupRequestResponse,
      recipient: sender.phoneNumber,
    },
  })
  // notify admins of signup request
  return Promise.all(
    adminPhoneNumbers.map(async adminPhoneNumber => {
      // these messages contain user phone numbers so they should ALWAYS disappear
      await signal.setExpiration(
        sock,
        channel.phoneNumber,
        adminPhoneNumber,
        defaultMessageExpiryTime,
      )
      return notify({
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
}

const handleCommandResult = async ({ commandResult, dispatchable }) => {
  const { command, message, status } = commandResult
  await respond({ ...dispatchable, message, command, status })
  await sendNotifications({ commandResult, dispatchable })
  await wait(minResendInterval) // paranoid pause to ward off rate-limiting demons
  await setExpiryTimeForNewUsers({ commandResult, dispatchable })
  return Promise.resolve()
}

/************
 * SENDING
 ************/

// Dispatchable -> Promise<void>
const broadcast = async ({ db, sock, channel, sdMessage }) => {
  const recipients = channel.memberships.map(m => m.memberPhoneNumber)
  const recipientBatches = batchesOfN(recipients, broadcastBatchSize)

  return flatten(
    await sequence(
      recipientBatches.map(recipientBatch => () => {
        signal
          .broadcastMessage(sock, recipientBatch, addHeader({ channel, sdMessage }))
          .then(() => messageCountRepository.countBroadcast(db, channel))
      }),
      broadcastBatchInterval,
    ),
  )
}

// Dispatchable -> Promise<void>
const relayHotlineMessage = async ({ db, sock, channel, sender, sdMessage }) => {
  const { language } = sender
  const recipients = channelRepository.getAdminMemberships(channel)
  const response = messagesIn(language).notifications.hotlineMessageSent(channel)

  await Promise.all(
    recipients.map(recipient =>
      notify({
        sock,
        channel,
        notification: {
          recipient: recipient.memberPhoneNumber,
          message: addHeader({
            channel,
            sdMessage,
            messageType: HOTLINE_MESSAGE,
            language: recipient.language,
          }).messageBody,
        },
      }),
    ),
  )

  return signal
    .sendMessage(sock, sender.phoneNumber, sdMessageOf(channel, response))
    .then(() => messageCountRepository.countHotline(db, channel))
}

// (Database, Socket, Channel, string, Sender) -> Promise<void>
const respond = ({ db, sock, channel, message, sender }) => {
  return signal
    .sendMessage(sock, sender.phoneNumber, sdMessageOf(channel, message))
    .then(() => messageCountRepository.countCommand(db, channel))
}

// ({ CommandResult, Dispatchable )) -> Promise<SignalboostStatus>
const sendNotifications = ({ commandResult, dispatchable }) => {
  const { sock, channel } = dispatchable
  const { status, notifications } = commandResult

  return status === statuses.SUCCESS
    ? Promise.all(notifications.map(notification => notify({ sock, channel, notification })))
    : Promise.resolve([])
}

// ({Socket, Channel, Notification}) -> Promise<void>
const notify = ({ sock, channel, notification }) =>
  signal.sendMessage(sock, notification.recipient, sdMessageOf(channel, notification.message))

// ({ CommandResult, Dispatchable }) -> Promise<void>
const setExpiryTimeForNewUsers = async ({ commandResult, dispatchable }) => {
  // for newly added users, make sure disappearing message timer
  // is set to channel's default expiry time
  const { command, status } = commandResult
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
