const { commands, statuses } = require('./constants')
const channelRepository = require('../../../db/repositories/channel')
const membershipRepository = require('../../../db/repositories/membership')
const validator = require('../../../db/validations/phoneNumber')
const logger = require('../logger')
const { messagesIn } = require('../strings/messages')
const { memberTypes } = require('../../../db/repositories/membership')
const { ADMIN, NONE } = memberTypes
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
  if (channel.phoneNumber === signupPhoneNumber && sender.type !== ADMIN) return noop()
  const result = await ({
    [commands.ADD]: () => maybeAddAdmin(db, channel, sender, payload),
    [commands.HELP]: () => showHelp(db, channel, sender),
    [commands.INFO]: () => showInfo(db, channel, sender),
    [commands.JOIN]: () => maybeAddSubscriber(db, channel, sender, language),
    [commands.LEAVE]: () => maybeRemoveSender(db, channel, sender),
    [commands.RENAME]: () => maybeRenameChannel(db, channel, sender, payload),
    [commands.REMOVE]: () => maybeRemoveAdmin(db, channel, sender, payload),
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

const maybeAddAdmin = async (db, channel, sender, phoneNumberInput) => {
  const cr = messagesIn(sender.language).commandResponses.add
  if (!(sender.type === ADMIN)) {
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
  }
  const { isValid, phoneNumber } = validator.parseValidPhoneNumber(phoneNumberInput)
  if (!isValid) return { status: statuses.ERROR, message: cr.invalidNumber(phoneNumberInput) }
  return addAdmin(db, channel, sender, phoneNumber, cr)
}

const addAdmin = (db, channel, sender, newAdminNumber, cr) =>
  membershipRepository
    .addAdmin(db, channel.phoneNumber, newAdminNumber)
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(newAdminNumber),
      payload: newAdminNumber,
    }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(newAdminNumber) }))

// HELP

const showHelp = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.help
  return {
    status: statuses.SUCCESS,
    message: sender.type === ADMIN ? cr.admin : cr.subscriber,
  }
}

// INFO

const showInfo = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.info
  return { status: statuses.SUCCESS, message: cr[sender.type](channel) }
}

// JOIN

const maybeAddSubscriber = async (db, channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.join
  return sender.type === NONE
    ? addSubscriber(db, channel, sender, language, cr)
    : Promise.resolve({ status: statuses.ERROR, message: cr.alreadyMember })
}

const addSubscriber = (db, channel, sender, language, cr) =>
  membershipRepository
    .addSubscriber(db, channel.phoneNumber, sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel) }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))

// LEAVE

const maybeRemoveSender = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.leave
  return sender.type === NONE
    ? Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notSubscriber })
    : removeSender(db, channel, sender, cr)
}

const removeSender = (db, channel, sender, cr) => {
  const remove =
    sender.type === ADMIN ? membershipRepository.removeAdmin : membershipRepository.removeSubscriber
  return remove(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))
}

// REMOVE

const maybeRemoveAdmin = async (db, channel, sender, adminNumber) => {
  const cr = messagesIn(sender.language).commandResponses.remove
  const { isValid, phoneNumber: validNumber } = validator.parseValidPhoneNumber(adminNumber)

  if (!(sender.type === ADMIN)) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }
  if (!isValid) {
    return { status: statuses.ERROR, message: cr.invalidNumber(adminNumber) }
  }
  if (!(await membershipRepository.isAdmin(db, channel.phoneNumber, validNumber)))
    return { status: statuses.ERROR, message: cr.targetNotAdmin(validNumber) }

  return removeAdmin(db, channel, validNumber, cr)
}

const removeAdmin = async (db, channel, adminNumber, cr) =>
  membershipRepository
    .removeAdmin(db, channel.phoneNumber, adminNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(adminNumber) }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(adminNumber) }))

// RENAME

const maybeRenameChannel = async (db, channel, sender, newName) => {
  const cr = messagesIn(sender.language).commandResponses.rename
  return sender.type === ADMIN
    ? renameChannel(db, channel, newName, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
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
  if (!(sender.type === ADMIN)) {
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
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
  return membershipRepository
    .updateLanguage(db, sender.phoneNumber, language)
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
