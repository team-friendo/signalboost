const signal = require('../signal')
const channelRepository = require('../../db/repositories/channel')
const messageCountRepository = require('../../db/repositories/messageCount')
const hotlineMessageRepository = require('../../db/repositories/hotlineMessage')
const { messagesIn } = require('./strings/messages')
const { sdMessageOf } = require('../signal')
const { memberTypes } = require('../../db/repositories/membership')
const { values, isEmpty } = require('lodash')
const { commands } = require('./commands/constants')
const { statuses } = require('../../services/util')
const { wait, sequence, batchesOfN } = require('../util')
const { loggerOf } = require('../util')
const logger = loggerOf('messenger')
const {
  defaultLanguage,
  signal: {
    signupPhoneNumber,
    defaultMessageExpiryTime,
    setExpiryInterval,
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
  PRIVATE_MESSAGE: 'PRIVATE_MESSAGE',
}

const {
  BROADCAST_MESSAGE,
  HOTLINE_MESSAGE,
  COMMAND_RESULT,
  SIGNUP_MESSAGE,
  PRIVATE_MESSAGE,
} = messageTypes

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
  await wait(setExpiryInterval) // to ensure welcome notification arrives first
  await setExpiryTimeForNewUsers({ commandResult, dispatchable })
  return Promise.resolve()
}

/************
 * SENDING
 ************/

// Dispatchable -> Promise<MessageCount>
const broadcast = async ({ db, sock, channel, sdMessage }) => {
  const recipients = channel.memberships

  try {
    if (isEmpty(sdMessage.attachments)) {
      await Promise.all(
        recipients.map(recipient =>
          signal.broadcastMessage(
            sock,
            [recipient.memberPhoneNumber],
            addHeader({
              channel,
              sdMessage,
              messageType: BROADCAST_MESSAGE,
              language: recipient.language,
              memberType: recipient.type,
            }),
          ),
        ),
      )
    } else {
      const recipientBatches = batchesOfN(recipients, broadcastBatchSize)
      await sequence(
        recipientBatches.map(recipientBatch => {
          recipientBatch.map(recipient => {
            signal.broadcastMessage(
              sock,
              [recipient.memberPhoneNumber],
              addHeader({
                channel,
                sdMessage,
                messageType: BROADCAST_MESSAGE,
                language: recipient.language,
                memberType: recipient.type,
              }),
            )
          })
        }),
        broadcastBatchInterval,
      )
    }
    return messageCountRepository.countBroadcast(db, channel)
  } catch (e) {
    logger.error(e)
  }
}

// Dispatchable -> Promise<void>
const relayHotlineMessage = async ({ db, sock, channel, sender, sdMessage }) => {
  const { language } = sender
  const recipients = channelRepository.getAdminMemberships(channel)
  const response = messagesIn(language).notifications.hotlineMessageSent(channel)

  const messageId = await hotlineMessageRepository.getMessageId({
    db,
    channelPhoneNumber: channel.phoneNumber,
    memberPhoneNumber: sender.phoneNumber,
  })

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
            messageId,
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
const respond = ({ db, sock, channel, message, sender, command, status }) => {
  // FIX: PRIVATE command sends out all messages including to sender
  // because respond doesn't handle attachments, don't want to repeat message here
  if (command === commands.PRIVATE && status === statuses.SUCCESS) return

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
  const { command, payload, status } = commandResult
  const { sock, channel, sender } = dispatchable

  if (status !== statuses.SUCCESS) return Promise.resolve()

  switch (command) {
    case commands.ADD:
      // in ADD case, payload is an e164 phone number
      // must be e164, else parse step would have failed and cmd could not have executed successfully
      return signal.setExpiration(sock, channel.phoneNumber, payload, channel.messageExpiryTime)
    case commands.INVITE:
      // in INVITE case, payload is an array of e164 phone numbers (must be e164 for same reasons as ADD above)
      return Promise.all(
        payload.map(memberPhoneNumber =>
          signal.setExpiration(
            sock,
            channel.phoneNumber,
            memberPhoneNumber,
            channel.messageExpiryTime,
          ),
        ),
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
const addHeader = ({ channel, sdMessage, messageType, language, memberType, messageId }) => {
  let prefix
  if (messageType === HOTLINE_MESSAGE) {
    prefix = `[${messagesIn(language).prefixes.hotlineMessage(messageId)}]\n`
  } else if (messageType === BROADCAST_MESSAGE) {
    if (memberType === 'ADMIN') {
      prefix = `[${messagesIn(language).prefixes.broadcastMessage}]\n`
    } else {
      prefix = `[${channel.name}]\n`
    }
  } else if (messageType === PRIVATE_MESSAGE) {
    prefix = `[${messagesIn(language).prefixes.privateMessage}]\n`
  }

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
