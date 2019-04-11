const channelRepository = require('../../db/repositories/channel')
const validator = require('../../db/validations')
const logger = require('./logger')
const { commandResponses } = require('./messages')

// CONSTANTS

const statuses = {
  NOOP: 'NOOP',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
}

const commands = {
  ADD_ADMIN: 'ADD_ADMIN',
  INFO: 'INFO',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  NOOP: 'NOOP',
  REMOVE_ADMIN: 'REMOVE_ADMIN',
  RENAME: 'RENAME',
}

// PUBLIC FUNCTIONS

// Dispatchable -> Promise<CommandResult>
const processCommand = dispatchable =>
  execute({ ...parseCommand(dispatchable.message), ...dispatchable })

const parseCommand = msg => {
  const _msg = msg.trim()
  if (_msg.match(/^add\s?admin/i))
    return { command: commands.ADD_ADMIN, payload: _msg.match(/^add\s?admin\s?(.*)/i)[1] }
  else if (_msg.match(/^info$/i)) return { command: commands.INFO }
  else if (_msg.match(/^join$/i)) return { command: commands.JOIN }
  else if (_msg.match(/^leave$/i)) return { command: commands.LEAVE }
  else if (_msg.match(/^remove\s?admin/i))
    return { command: commands.REMOVE_ADMIN, payload: _msg.match(/^remove\s?admin\s?(.*)$/i)[1] }
  else if (_msg.match(/^rename/i))
    return { command: commands.RENAME, payload: _msg.match(/^rename\s?(.*)$/i)[1] }
  else return { command: commands.NOOP }
}

const execute = async dispatchable => {
  const { command, payload, db, channel, sender } = dispatchable
  const result = await ({
    [commands.ADD_ADMIN]: () => maybeAddAdmin(db, channel, sender, payload),
    [commands.INFO]: () => maybeShowInfo(db, channel, sender),
    [commands.JOIN]: () => maybeAddSubscriber(db, channel, sender),
    [commands.LEAVE]: () => maybeRemoveSubscriber(db, channel, sender),
    [commands.RENAME]: () => maybeRenameChannel(db, channel, sender, payload),
    [commands.REMOVE_ADMIN]: () => maybeRemoveAdmin(db, channel, sender, payload),
  }[command] || noop)()
  return { commandResult: { ...result, command }, dispatchable }
}

// PRIVATE FUNCTIONS

// ADMIN ACTIONS

const maybeAddAdmin = async (db, channel, sender, newAdminNumber) => {
  const cr = commandResponses.admin.add
  if (!sender.isAdmin) return { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
  if (!validator.validatePhoneNumber(newAdminNumber))
    return { status: statuses.ERROR, message: cr.invalidNumber(newAdminNumber) }
  return addAdmin(db, channel, sender, newAdminNumber, cr)
}

const addAdmin = (db, channel, sender, newAdminNumber, cr) =>
  channelRepository
    .addAdmin(db, channel.phoneNumber, newAdminNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(newAdminNumber) }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(newAdminNumber) }))

const maybeRemoveAdmin = async (db, channel, sender, adminNumber) => {
  const cr = commandResponses.admin.remove
  if (!sender.isAdmin) return { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
  if (!validator.validatePhoneNumber(adminNumber))
    return { status: statuses.ERROR, message: cr.invalidNumber(adminNumber) }
  if (!(await channelRepository.isAdmin(db, channel.phoneNumber, adminNumber)))
    return { status: statuses.ERROR, message: cr.targetNotAdmin(adminNumber) }
  return removeAdmin(db, channel, adminNumber, cr)
}

const removeAdmin = async (db, channel, adminNumber, cr) =>
  channelRepository
    .removeAdmin(db, channel.phoneNumber, adminNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(adminNumber) }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(adminNumber) }))

// INFO

const maybeShowInfo = async (db, channel, sender) => {
  const cr = commandResponses.info
  return sender.isAdmin || sender.isSubscriber
    ? showInfo(db, channel, sender, cr)
    : { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
}

const showInfo = async (db, channel, sender, cr) => ({
  status: statuses.SUCCESS,
  message: sender.isAdmin ? cr.admin(channel) : cr.subscriber(channel),
})

// RENAME

const maybeRenameChannel = async (db, channel, sender, newName) => {
  const cr = commandResponses.rename
  return sender.isAdmin
    ? renameChannel(db, channel, newName, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.unauthorized })
}

const renameChannel = (db, channel, newName, cr) =>
  channelRepository
    .update(db, channel.phoneNumber, { name: newName })
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel.name, newName) }))
    .catch(err =>
      logAndReturn(err, { status: statuses.ERROR, message: cr.error(channel.name, newName) }),
    )

// SUBSCRIBER ACTIONS

const maybeAddSubscriber = async (db, channel, sender) => {
  const cr = commandResponses.subscriber.add
  return sender.isSubscriber
    ? Promise.resolve({ status: statuses.NOOP, message: cr.noop })
    : addSubscriber(db, channel, sender, cr)
}

const addSubscriber = (db, channel, sender, cr) =>
  channelRepository
    .addSubscriber(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))

const maybeRemoveSubscriber = async (db, channel, sender) => {
  const cr = commandResponses.subscriber.remove
  return sender.isSubscriber
    ? removeSubscriber(db, channel, sender.phoneNumber, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.unauthorized })
}

const removeSubscriber = (db, channel, sender, cr) =>
  channelRepository
    .removeSubscriber(db, channel.phoneNumber, sender)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))

// NOOP
const noop = () =>
  Promise.resolve({
    status: statuses.NOOP,
    message: commandResponses.noop,
  })

const logAndReturn = (err, statusTuple) => {
  logger.error(err)
  return statusTuple
}

module.exports = { statuses, commands, processCommand, parseCommand, execute }
