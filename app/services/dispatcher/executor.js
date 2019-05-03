const channelRepository = require('../../db/repositories/channel')
const validator = require('../../db/validations')
const logger = require('./logger')
const { commandResponses } = require('./messages')

/*
 * type Executable = {
 *   command: string,
 *   payload: ?string,
 * }
 * */

// CONSTANTS

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
}

// PUBLIC FUNCTIONS

// Dispatchable -> Promise<{dispatchable: Dispatchable, commandResult: CommandResult}>
const processCommand = dispatchable =>
  execute({ ...parseCommand(dispatchable.message.messageBody), ...dispatchable })

// string -> Executable
const parseCommand = msg => {
  const _msg = msg.trim()
  if (_msg.match(/^add/i)) return { command: commands.ADD, payload: _msg.match(/^add\s?(.*)/i)[1] }
  else if (_msg.match(/^help$/i)) return { command: commands.HELP }
  else if (_msg.match(/^info$/i)) return { command: commands.INFO }
  else if (_msg.match(/^join$/i)) return { command: commands.JOIN }
  else if (_msg.match(/^leave$/i)) return { command: commands.LEAVE }
  else if (_msg.match(/^remove/i))
    return { command: commands.REMOVE, payload: _msg.match(/^remove\s?(.*)$/i)[1] }
  else if (_msg.match(/^rename/i))
    return { command: commands.RENAME, payload: _msg.match(/^rename\s?(.*)$/i)[1] }
  else return { command: commands.NOOP }
}

// Distpathcable -> Promise<{dispatchable: Dispatchable, commandResult: CommandResult}>
const execute = async dispatchable => {
  const { command, payload, db, channel, sender } = dispatchable
  const result = await ({
    [commands.ADD]: () => maybeAddPublisher(db, channel, sender, payload),
    [commands.HELP]: () => maybeShowHelp(db, channel, sender),
    [commands.INFO]: () => maybeShowInfo(db, channel, sender),
    [commands.JOIN]: () => maybeAddSubscriber(db, channel, sender),
    [commands.LEAVE]: () => maybeRemoveSender(db, channel, sender),
    [commands.RENAME]: () => maybeRenameChannel(db, channel, sender, payload),
    [commands.REMOVE]: () => maybeRemovePublisher(db, channel, sender, payload),
  }[command] || noop)()
  return { commandResult: { ...result, command }, dispatchable }
}

// PRIVATE FUNCTIONS

// ADD

const maybeAddPublisher = async (db, channel, sender, newPublisherNumber) => {
  const cr = commandResponses.publisher.add
  if (!sender.isPublisher) return { status: statuses.UNAUTHORIZED, messageBody: cr.unauthorized }
  if (!validator.validatePhoneNumber(newPublisherNumber))
    return { status: statuses.ERROR, messageBody: cr.invalidNumber(newPublisherNumber) }
  return addPublisher(db, channel, sender, newPublisherNumber, cr)
}

const addPublisher = (db, channel, sender, newPublisherNumber, cr) =>
  channelRepository
    .addPublisher(db, channel.phoneNumber, newPublisherNumber)
    .then(() => ({
      status: statuses.SUCCESS,
      messageBody: cr.success(newPublisherNumber),
      payload: newPublisherNumber,
    }))
    .catch(() => ({ status: statuses.ERROR, messageBody: cr.dbError(newPublisherNumber) }))

// HELP

const maybeShowHelp = async (db, channel, sender) => {
  const cr = commandResponses.help
  return sender.isPublisher || sender.isSubscriber
    ? showHelp(db, channel, sender, cr)
    : { status: statuses.UNAUTHORIZED, messageBody: cr.unauthorized }
}

const showHelp = async (db, channel, sender, cr) => ({
  status: statuses.SUCCESS,
  messageBody: sender.isPublisher ? cr.publisher : cr.subscriber,
})

// INFO

const maybeShowInfo = async (db, channel, sender) => {
  const cr = commandResponses.info
  return sender.isPublisher || sender.isSubscriber
    ? showInfo(db, channel, sender, cr)
    : { status: statuses.UNAUTHORIZED, messageBody: cr.unauthorized }
}

const showInfo = async (db, channel, sender, cr) => ({
  status: statuses.SUCCESS,
  messageBody: sender.isPublisher ? cr.publisher(channel) : cr.subscriber(channel),
})

// JOIN

const maybeAddSubscriber = async (db, channel, sender) => {
  const cr = commandResponses.subscriber.add
  return sender.isSubscriber
    ? Promise.resolve({ status: statuses.NOOP, messageBody: cr.noop })
    : addSubscriber(db, channel, sender, cr)
}

const addSubscriber = (db, channel, sender, cr) =>
  channelRepository
    .addSubscriber(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, messageBody: cr.success(channel) }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, messageBody: cr.error }))

// LEAVE

const maybeRemoveSender = async (db, channel, sender) => {
  const cr = commandResponses.subscriber.remove
  return sender.isSubscriber || sender.isPublisher
    ? removeSender(db, channel, sender, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, messageBody: cr.unauthorized })
}

const removeSender = (db, channel, sender, cr) => {
  const remove = sender.isPublisher
    ? channelRepository.removePublisher
    : channelRepository.removeSubscriber
  return remove(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, messageBody: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, messageBody: cr.error }))
}

// REMOVE

const maybeRemovePublisher = async (db, channel, sender, publisherNumber) => {
  const cr = commandResponses.publisher.remove
  if (!sender.isPublisher) return { status: statuses.UNAUTHORIZED, messageBody: cr.unauthorized }
  if (!validator.validatePhoneNumber(publisherNumber))
    return { status: statuses.ERROR, messageBody: cr.invalidNumber(publisherNumber) }
  if (!(await channelRepository.isPublisher(db, channel.phoneNumber, publisherNumber)))
    return { status: statuses.ERROR, messageBody: cr.targetNotPublisher(publisherNumber) }
  return removePublisher(db, channel, publisherNumber, cr)
}

const removePublisher = async (db, channel, publisherNumber, cr) =>
  channelRepository
    .removePublisher(db, channel.phoneNumber, publisherNumber)
    .then(() => ({ status: statuses.SUCCESS, messageBody: cr.success(publisherNumber) }))
    .catch(() => ({ status: statuses.ERROR, messageBody: cr.dbError(publisherNumber) }))

// RENAME

const maybeRenameChannel = async (db, channel, sender, newName) => {
  const cr = commandResponses.rename
  return sender.isPublisher
    ? renameChannel(db, channel, newName, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, messageBody: cr.unauthorized })
}

const renameChannel = (db, channel, newName, cr) =>
  channelRepository
    .update(db, channel.phoneNumber, { name: newName })
    .then(() => ({ status: statuses.SUCCESS, messageBody: cr.success(channel.name, newName) }))
    .catch(err =>
      logAndReturn(err, { status: statuses.ERROR, messageBody: cr.dbError(channel.name, newName) }),
    )

// NOOP
const noop = () =>
  Promise.resolve({
    status: statuses.NOOP,
    messageBody: commandResponses.noop,
  })

const logAndReturn = (err, statusTuple) => {
  // TODO(@zig): add prometheus error count here (counter: db_error)
  logger.error(err)
  return statusTuple
}

module.exports = { statuses, commands, processCommand, parseCommand, execute }
