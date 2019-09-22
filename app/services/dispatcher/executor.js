const channelRepository = require('../../db/repositories/channel')
const validator = require('../../db/validations/phoneNumber')
const logger = require('./logger')
const { messagesIn } = require('./messages')
const { senderTypes } = require('../../constants')
const { PUBLISHER, SUBSCRIBER, RANDOM } = senderTypes
const { lowerCase } = require('lodash')
const safetyNumberService = require('../registrar/safetyNumbers')

/**
 * type Executable = {
 *   command: string,
 *   payload: ?string,
 * }
 *
 * type CommandResult = {
 *   status: string,
 *   command: string,
 *   message: string,
 * }
 *
 * */

/*************
 * CONSTANTS
 *************/

const statuses = {
  NOOP: 'NOOP',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
}

const commands = {
  ADD: 'ADD',
  HELP: 'HELP',
  INFO: 'INFO',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  NOOP: 'NOOP',
  REMOVE: 'REMOVE',
  RENAME: 'RENAME',
  TOGGLE_RESPONSES: 'TOGGLE_RESPONSES',
  REAUTHORIZE: 'REAUTHORIZE',
}

/******************
 * INPUT HANDLING
 ******************/

// Dispatchable -> Promise<{dispatchable: Dispatchable, commandResult: CommandResult}>
const processCommand = dispatchable =>
  execute(parseCommand(dispatchable.sdMessage.messageBody), dispatchable)

// string -> Executable
const parseCommand = msg => {
  const _msg = msg.trim()
  if (_msg.match(/^add/i)) return { command: commands.ADD, payload: _msg.match(/^add\s?(.*)/i)[1] }
  else if (_msg.match(/^(help|ayuda)$/i)) return { command: commands.HELP }
  else if (_msg.match(/^info$/i)) return { command: commands.INFO }
  // TODO(aguestuser|2019-08-30): handle spansish variations with proper localization
  else if (_msg.match(/^(join|hello|hola)$/i)) return { command: commands.JOIN }
  else if (_msg.match(/^(leave|goodbye|adios)$/i)) return { command: commands.LEAVE }
  else if (_msg.match(/^remove/i))
    return { command: commands.REMOVE, payload: _msg.match(/^remove\s?(.*)$/i)[1] }
  else if (_msg.match(/^rename/i))
    return { command: commands.RENAME, payload: _msg.match(/^rename\s?(.*)$/i)[1] }
  else if (_msg.match(/^responses/i))
    return { command: commands.TOGGLE_RESPONSES, payload: _msg.match(/^responses\s?(.*)$/i)[1] }
  else if (_msg.match(/^reauthorize/i))
    return { command: commands.REAUTHORIZE, payload: _msg.match(/^reauthorize\s?(.*)$/i)[1] }
  else return { command: commands.NOOP }
}

// (Executable, Distpatchable) -> Promise<{dispatchable: Dispatchable, commandResult: CommandResult}>
const execute = async (executable, dispatchable) => {
  const { command, payload } = executable
  const { db, sock, channel, sender } = dispatchable
  const result = await ({
    [commands.ADD]: () => maybeAddPublisher(db, channel, sender, payload),
    [commands.HELP]: () => maybeShowHelp(db, channel, sender),
    [commands.INFO]: () => maybeShowInfo(db, channel, sender),
    [commands.JOIN]: () => maybeAddSubscriber(db, channel, sender),
    [commands.LEAVE]: () => maybeRemoveSender(db, channel, sender),
    [commands.RENAME]: () => maybeRenameChannel(db, channel, sender, payload),
    [commands.REMOVE]: () => maybeRemovePublisher(db, channel, sender, payload),
    [commands.TOGGLE_RESPONSES]: () => maybeToggleResponses(db, channel, sender, payload),
    [commands.REAUTHORIZE]: () => maybeTrust(db, sock, channel, sender, payload),
  }[command] || (() => noop(sender)))()
  return { ...result, command }
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

//TODO: extract `executable` from `dispatchable`

const maybeShowHelp = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.help
  return sender.type === RANDOM
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
  return sender.type === RANDOM
    ? { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
    : showInfo(db, channel, sender, cr)
}

const showInfo = async (db, channel, sender, cr) => ({
  status: statuses.SUCCESS,
  message: sender.type === PUBLISHER ? cr.publisher(channel) : cr.subscriber(channel),
})

// JOIN

const maybeAddSubscriber = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.subscriber.add
  return sender.type === SUBSCRIBER
    ? Promise.resolve({ status: statuses.NOOP, message: cr.noop })
    : addSubscriber(db, channel, sender, cr)
}

const addSubscriber = (db, channel, sender, cr) =>
  channelRepository
    .addSubscriber(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel) }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))

// LEAVE

const maybeRemoveSender = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.subscriber.remove
  return sender.type === RANDOM
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

const maybeToggleResponses = async (db, channel, sender, newSetting) => {
  const cr = messagesIn(sender.language).commandResponses.toggleResponses
  if (!(sender.type === PUBLISHER)) {
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.unauthorized })
  }
  if (!['on', 'off'].includes(lowerCase(newSetting))) {
    return Promise.resolve({ status: statuses.ERROR, message: cr.invalidSetting(newSetting) })
  }
  return toggleResponses(db, channel, newSetting, sender, cr)
}

const toggleResponses = (db, channel, newSetting, sender, cr) =>
  channelRepository
    .update(db, channel.phoneNumber, { responsesEnabled: lowerCase(newSetting) === 'on' })
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(newSetting) }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError(newSetting) }))

// REAUTHORIZE

const maybeTrust = async (db, sock, channel, sender, publisherNumber) => {
  const cr = messagesIn(sender.language).commandResponses.trust
  const { isValid, phoneNumber: validNumber } = validator.parseValidPhoneNumber(publisherNumber)

  if (!(sender.type === PUBLISHER)) {
    return { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
  }
  if (!isValid) {
    return { status: statuses.ERROR, message: cr.invalidNumber(publisherNumber) }
  }
  if (
    (await channelRepository.resolveSenderType(db, channel.phoneNumber, validNumber)) === RANDOM
  ) {
    return { status: statuses.ERROR, message: cr.targetNotMember(publisherNumber) }
  }

  return trust(db, sock, validNumber, cr)
}

const trust = (db, sock, memberPhoneNumber, cr) => {
  // TODO(aguestuser|2019-09-22): redo the return value signaling when we confine trusting to a single channel
  return safetyNumberService.trust(db, sock, memberPhoneNumber).then(({ successes, errors }) => {
    if (errors > 0) {
      return {
        status: statuses.ERROR,
        message: cr.partialError(memberPhoneNumber, successes, errors),
        payload: memberPhoneNumber,
      }
    }
    return {
      status: statuses.SUCCESS,
      message: cr.success(memberPhoneNumber),
      payload: memberPhoneNumber,
    }
  })
}

// NOOP
const noop = sender =>
  Promise.resolve({
    status: statuses.NOOP,
    message: messagesIn(sender.language).notifications.noop,
  })

/**********
 * HELPERS
 **********/

const logAndReturn = (err, statusTuple) => {
  // TODO(@zig): add prometheus error count here (counter: db_error)
  logger.error(err)
  return statusTuple
}

module.exports = { statuses, commands, processCommand, parseCommand, execute }
