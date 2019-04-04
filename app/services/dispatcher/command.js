const channelRepository = require('../../db/repositories/channel')
const { channelName } = require('../../config')
const validator = require('../../db/validations')

// CONSTANTS

// TODO: replace FAILURE with ERROR...
const statuses = {
  NOOP: 'NOOP',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
}

const commands = {
  ADD_ADMIN: 'ADD_ADMIN',
  REMOVE_ADMIN: 'REMOVE_ADMIN',
  INFO: 'INFO',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  NOOP: 'NOOP',
}

const messages = {
  // GENERAL MESSAGES
  INVALID: "Whoops! That's not a command!",

  // INFO MESSAGES
  INFO: (channelPhoneNumber, admins, subscribers) =>
    `You are an admin of the channel "${channelName}":\n\n- phone number: ${channelPhoneNumber}\n- subscribers: ${subscribers}\n- admins: ${admins}`,
  INFO_NOOP: `Whoops! You cannot retrieve info for a channel you do not belong to.`,

  // ADD/REMOVE ADMIN MESSAGES
  ADD_ADMIN_NOOP_NOT_ADMIN: `Whoops! You are not an admin of this channel. We can't let you add other admins to it. Sorry!`,
  ADD_ADMIN_NOOP_INVALID_NUMBER: num =>
    `Whoops! Signalboost could not understand "${num}." Phone numbers must include country codes but omit commas, dashes, parentheses, and spaces. \n\nFor example: to add (202) 555-4444, write:\n\n "ADD ADMIN +12025554444"`,
  ADD_ADMIN_SUCCESS: num => `You successfully added ${num} as an admin of "${channelName}"! Yay!`,
  ADD_ADMIN_FAILURE: num =>
    `Whoops! There was an error adding ${num} to "${channelName}". Please try again!`,
  REMOVE_ADMIN_NOOP_SENDER_NOT_ADMIN: `Whoops! You are not an admin of this channel. We can't let you add other admins to it. Sorry!`,
  REMOVE_ADMIN_NOOP_INVALID_NUMBER: num =>
    `Whoops! Signalboost could not understand "${num}." Phone numbers must include country codes but omit commas, dashes, parentheses, and spaces.\n\nFor example: to remove (202) 555-4444, write:\n\n "REMOVE ADMIN +12025554444"`,
  REMOVE_ADMIN_NOOP_TARGET_NOT_ADMIN: num => `Whoops! ${num} is not an admin of "${channelName}".`,
  REMOVE_ADMIN_SUCCESS: num => `${num} was successfully removed as an admin of "${channelName}"`,
  REMOVE_ADMIN_FAILURE: num =>
    `Whoops! There was an error trying to remove ${num} from ${channelName}. Please try again!`,

  // JOIN/LEAVE MESSAGES
  JOIN_SUCCESS: `You've been added to the "${channelName}" channel! Yay!`,
  JOIN_FAILURE: `Whoops! There was an error adding you to the "${channelName}" signalboost channel. Please try again!`,
  JOIN_NOOP: 'Whoops! You are already a member of that signalboost channel!',
  LEAVE_SUCCESS: `You've been removed from the "${channelName}" channel! Bye!`,
  LEAVE_FAILURE: `Whoops! There was an error removing you from the "${channelName}" signalboost channel. Please try again!`,
  LEAVE_NOOP: 'Whoops! You are not subscribed to that channel. How ya gonna leave it?',
}

// PUBLIC FUNCTIONS

const parseCommand = msg => {
  const _msg = msg.trim()
  if (_msg.match(/^add\s?admin/i))
    return { command: commands.ADD_ADMIN, payload: _msg.match(/^add\s?admin\s?(.*)/i)[1] }
  else if (_msg.match(/^remove\s?admin/i))
    return { command: commands.REMOVE_ADMIN, payload: _msg.match(/^remove\s?admin\s?(.*)/i)[1] }
  else if (_msg.match(/^info$/i)) return { command: commands.INFO }
  else if (_msg.match(/^join$/i)) return { command: commands.JOIN }
  if (_msg.match(/^leave$/i)) return { command: commands.LEAVE }
  else return { command: commands.NOOP }
}

const execute = ({ command, payload, db, channelPhoneNumber, sender }) => {
  switch (command) {
    case commands.ADD_ADMIN:
      return maybeAddAdmin(db, channelPhoneNumber, sender, payload)
    case commands.REMOVE_ADMIN:
      return maybeRemoveAdmin(db, channelPhoneNumber, sender, payload)
    case commands.INFO:
      return maybeShowInfo(db, channelPhoneNumber, sender)
    case commands.JOIN:
      return maybeAddSubscriber(db, channelPhoneNumber, sender)
    case commands.LEAVE:
      return maybeRemoveSubscriber(db, channelPhoneNumber, sender)
    default:
      return noop()
  }
}

// PRIVATE FUNCTIONS

// ADD/REMOVE ADMIN

const maybeAddAdmin = async (db, channelPhoneNumber, sender, newAdmin) => {
  const isAdmin = await channelRepository.isAdmin(db, channelPhoneNumber, sender)
  const isNumberValid = validator.validatePhoneNumber(newAdmin)

  if (!isAdmin) return { status: statuses.SUCCESS, message: messages.ADD_ADMIN_NOOP_NOT_ADMIN }
  if (!isNumberValid)
    return {
      status: statuses.SUCCESS,
      message: messages.ADD_ADMIN_NOOP_INVALID_NUMBER(newAdmin),
    }
  return addAdmin(db, channelPhoneNumber, sender, newAdmin)
}

const addAdmin = (db, channelPhoneNumber, sender, newAdmin) =>
  channelRepository
    .addAdmin(db, channelPhoneNumber, newAdmin)
    .then(() => ({ status: statuses.SUCCESS, message: messages.ADD_ADMIN_SUCCESS(newAdmin) }))
    .catch(() => ({
      status: statuses.FAILURE,
      message: messages.ADD_ADMIN_FAILURE(newAdmin),
    }))

const maybeRemoveAdmin = async (db, channelPhoneNumber, sender, admin) => {
  const isSenderAdmin = await channelRepository.isAdmin(db, channelPhoneNumber, sender)
  const isNumberValid = validator.validatePhoneNumber(admin)
  const isTargetAdmin = await channelRepository.isAdmin(db, channelPhoneNumber, admin)

  if (!isSenderAdmin)
    return { status: statuses.SUCCESS, message: messages.REMOVE_ADMIN_NOOP_SENDER_NOT_ADMIN }
  if (!isNumberValid)
    return { status: statuses.SUCCESS, message: messages.REMOVE_ADMIN_NOOP_INVALID_NUMBER(admin) }
  if (!isTargetAdmin)
    return { status: statuses.SUCCESS, message: messages.REMOVE_ADMIN_NOOP_TARGET_NOT_ADMIN(admin) }
  return removeAdmin(db, channelPhoneNumber, admin)
}

const removeAdmin = async (db, channelPhoneNumber, admin) =>
  channelRepository
    .removeAdmin(db, channelPhoneNumber, admin)
    .then(() => ({ status: statuses.SUCCESS, message: messages.REMOVE_ADMIN_SUCCESS(admin) }))
    .catch(() => ({ status: statuses.FAILURE, message: messages.REMOVE_ADMIN_FAILURE(admin) }))

// INFO

const maybeShowInfo = async (db, channelPhoneNumber, sender) => {
  const isAdmin = await channelRepository.isAdmin(db, channelPhoneNumber, sender)
  const isSubscriber = await channelRepository.isSubscriber(db, channelPhoneNumber, sender)

  if (isAdmin) return showInfo(db, channelPhoneNumber, 'admin')
  else if (isSubscriber) return showInfo(db, channelPhoneNumber, 'subscriber')
  else return { status: statuses.SUCCESS, message: messages.INFO_NOOP }
}

const showInfo = async (db, channelPhoneNumber, recipientType) => {
  const admins = await db.administration.findAll({ where: { channelPhoneNumber } })
  const subs = await db.subscription.findAll({ where: { channelPhoneNumber } })
  const message =
    recipientType !== 'admin'
      ? messages.INFO(channelPhoneNumber, admins.length, subs.length)
      : messages.INFO(
          channelPhoneNumber,
          admins.map(a => a.humanPhoneNumber).join(', '),
          subs.length,
        )

  return { status: statuses.SUCCESS, message }
}

// JOIN/LEAVE

const maybeAddSubscriber = async (db, channelPhoneNumber, sender) =>
  (await channelRepository.isSubscriber(db, channelPhoneNumber, sender))
    ? Promise.resolve({ status: statuses.SUCCESS, message: messages.JOIN_NOOP })
    : addSubscriber(db, channelPhoneNumber, sender)

const addSubscriber = (db, channelPhoneNumber, sender) =>
  channelRepository
    .addSubscriber(db, channelPhoneNumber, sender)
    .then(() => ({ status: statuses.SUCCESS, message: messages.JOIN_SUCCESS }))
    .catch(() => ({ status: statuses.FAILURE, message: messages.JOIN_FAILURE }))

const maybeRemoveSubscriber = async (db, channelPhoneNumber, sender) =>
  (await channelRepository.isSubscriber(db, channelPhoneNumber, sender))
    ? removeSubscriber(db, channelPhoneNumber, sender)
    : Promise.resolve({ status: statuses.SUCCESS, message: messages.LEAVE_NOOP })

const removeSubscriber = (db, channelPhoneNumber, sender) =>
  channelRepository
    .removeSubscriber(db, channelPhoneNumber, sender)
    .then(() => ({ status: statuses.SUCCESS, message: messages.LEAVE_SUCCESS }))
    .catch(() => ({ status: statuses.FAILURE, message: messages.LEAVE_FAILURE }))

// NOOP

const noop = () =>
  Promise.resolve({
    status: statuses.NOOP,
    message: messages.INVALID,
  })

module.exports = { statuses, commands, messages, parseCommand, execute }
