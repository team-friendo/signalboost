const { commands, statuses } = require('./constants')
const channelRepository = require('../../../db/repositories/channel')
const validator = require('../../../db/validations/phoneNumber')
const logger = require('../logger')
const { messagesIn } = require('../strings/messages')
const { memberTypes } = require('../../../db/repositories/channel')
const { PUBLISHER, SUBSCRIBER, NONE } = memberTypes
const {
  signal: { signupPhoneNumber },
} = require('../../../config')

/**
 * type Executable = {
 *   command: string,
 *   payload: string,
 *   language: 'EN' | 'ES'
 * }
 *
 * type CommandResult = {
 *   status: string,
 *   command: string,
 *   message: string,
 * }
 *
 * */

// (Executable, Distpatchable) -> Promise<{dispatchable: Dispatchable, commandResult: CommandResult}>
const execute = async (executable, dispatchable) => {
  const { command, payload, language } = executable
  const { db, channel, sender } = dispatchable
  // don't allow command execution on the signup channel for non-admins
  if (channel.phoneNumber === signupPhoneNumber && sender.type !== PUBLISHER) return noop()
  const result = await ({
    [commands.ADD]: () => maybeAddPublisher(db, channel, sender, payload),
    [commands.HELP]: () => maybeShowHelp(db, channel, sender),
    [commands.INFO]: () => maybeShowInfo(db, channel, sender),
    [commands.JOIN]: () => maybeAddSubscriber(db, channel, sender, language),
    [commands.LEAVE]: () => maybeRemoveSender(db, channel, sender),
    [commands.RENAME]: () => maybeRenameChannel(db, channel, sender, payload),
    [commands.REMOVE]: () => maybeRemovePublisher(db, channel, sender, payload),
    [commands.RESPONSES_ON]: () => maybeToggleResponses(db, channel, sender, true),
    [commands.RESPONSES_OFF]: () => maybeToggleResponses(db, channel, sender, false),
    [commands.SET_LANGUAGE]: () => setLanguage(db, sender, language),
  }[command] || (() => noop()))()
  return { command, ...result }
}

/********************
 * COMMAND EXECUTION
 ********************/

// ADD

const maybeAddPublisher = async (db, channel, sender, phoneNumberInput) => {
  const cr = messagesIn(sender.language).commandResponses.publisher.add
  if (!(sender.type === PUBLISHER)) {
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.unauthorized })
  }
  const { isValid, phoneNumber } = validator.parseValidPhoneNumber(phoneNumberInput)
  if (!isValid) return { status: statuses.ERROR, message: cr.invalidNumber(phoneNumberInput) }
  return addPublisher(db, channel, sender, phoneNumber, cr)
}

const addPublisher = (db, channel, sender, newPublisherNumber, cr) =>
  channelRepository
    .addPublisher(db, channel.phoneNumber, newPublisherNumber)
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(newPublisherNumber),
      payload: newPublisherNumber,
    }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(newPublisherNumber) }))

// HELP

const maybeShowHelp = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.help
  return sender.type === NONE
    ? { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
    : showHelp(db, channel, sender, cr)
}

const showHelp = async (db, channel, sender, cr) => ({
  status: statuses.SUCCESS,
  message: sender.type === PUBLISHER ? cr.publisher : cr.subscriber,
})

// INFO

const maybeShowInfo = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.info
  return sender.type === NONE
    ? { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
    : showInfo(db, channel, sender, cr)
}

const showInfo = async (db, channel, sender, cr) => ({
  status: statuses.SUCCESS,
  message: sender.type === PUBLISHER ? cr.publisher(channel) : cr.subscriber(channel),
})

// JOIN

const maybeAddSubscriber = async (db, channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.subscriber.add
  return sender.type === SUBSCRIBER
    ? Promise.resolve({ status: statuses.NOOP, message: cr.noop })
    : addSubscriber(db, channel, sender, language, cr)
}

const addSubscriber = (db, channel, sender, language, cr) =>
  channelRepository
    .addSubscriber(db, channel.phoneNumber, sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel) }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))

// LEAVE

const maybeRemoveSender = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.subscriber.remove
  return sender.type === NONE
    ? Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.unauthorized })
    : removeSender(db, channel, sender, cr)
}

const removeSender = (db, channel, sender, cr) => {
  const remove =
    sender.type === PUBLISHER
      ? channelRepository.removePublisher
      : channelRepository.removeSubscriber
  return remove(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))
}

// REMOVE

const maybeRemovePublisher = async (db, channel, sender, publisherNumber) => {
  const cr = messagesIn(sender.language).commandResponses.publisher.remove
  const { isValid, phoneNumber: validNumber } = validator.parseValidPhoneNumber(publisherNumber)

  if (!(sender.type === PUBLISHER)) {
    return { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
  }
  if (!isValid) {
    return { status: statuses.ERROR, message: cr.invalidNumber(publisherNumber) }
  }
  if (!(await channelRepository.isPublisher(db, channel.phoneNumber, validNumber)))
    return { status: statuses.ERROR, message: cr.targetNotPublisher(validNumber) }

  return removePublisher(db, channel, validNumber, cr)
}

const removePublisher = async (db, channel, publisherNumber, cr) =>
  channelRepository
    .removePublisher(db, channel.phoneNumber, publisherNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(publisherNumber) }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(publisherNumber) }))

// RENAME

const maybeRenameChannel = async (db, channel, sender, newName) => {
  const cr = messagesIn(sender.language).commandResponses.rename
  return sender.type === PUBLISHER
    ? renameChannel(db, channel, newName, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.unauthorized })
}

const renameChannel = (db, channel, newName, cr) =>
  channelRepository
    .update(db, channel.phoneNumber, { name: newName })
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel.name, newName) }))
    .catch(err =>
      logAndReturn(err, { status: statuses.ERROR, message: cr.dbError(channel.name, newName) }),
    )

// (Database, Channel, Sender, boolean) -> Promise<CommandResult>
const maybeToggleResponses = async (db, channel, sender, responsesEnabled) => {
  const cr = messagesIn(sender.language).commandResponses.toggleResponses
  if (!(sender.type === PUBLISHER)) {
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.unauthorized })
  }
  return toggleResponses(db, channel, responsesEnabled, sender, cr)
}

const toggleResponses = (db, channel, responsesEnabled, sender, cr) =>
  channelRepository
    .update(db, channel.phoneNumber, { responsesEnabled })
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(responsesEnabled ? 'ON' : 'OFF'),
    }))
    .catch(err =>
      logAndReturn(err, {
        status: statuses.ERROR,
        message: cr.dbError(responsesEnabled ? 'ON' : 'OFF'),
      }),
    )

// SET_LANGUAGE

const setLanguage = (db, sender, language) => {
  const cr = messagesIn(language).commandResponses.setLanguage
  return channelRepository
    .updateMemberLanguage(db, sender.phoneNumber, sender.type, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError }))
}

// NOOP
const noop = () => Promise.resolve({ command: commands.NOOP, status: statuses.NOOP, message: '' })

/**********
 * HELPERS
 **********/

const logAndReturn = (err, statusTuple) => {
  // TODO(@zig): add prometheus error count here (counter: db_error)
  logger.error(err)
  return statusTuple
}

module.exports = { execute }
