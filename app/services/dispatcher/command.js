const channelRepository = require('../../db/repositories/channel')
const { channelName } = require('../../config')
const { validatePhoneNumber } = require('../../db/validations')

// CONSTANTS

// TODO: replace FAILURE with ERROR...
const statuses = {
  NOOP: 'NOOP',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
}

const commands = {
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  NOOP: 'NOOP',
  ADD_ADMIN: 'ADD ADMIN',
}

// TODO: replace FAILURE with ERROR...
const messages = {
  INVALID: "Whoops! That's not a command!",
  ADD_ADMIN_NOOP_NOT_ADMIN: `Whoops! You are not an admin of ${channelName}. We can't let you add other admins to it. Sorry!`,
  ADD_ADMIN_NOOP_INVALID_NUMBER: num =>
    `Whoops! ${num} is does not have a valid format. Phone numbers must include country codes and omit hyphens and parenteses. For example, to add (202) 555-4444, you would write ADD ADMIN +12025554444`,
  ADD_ADMIN_SUCCESS: num => `You successfully added ${num} to ${channelName}! Yay!`,
  ADD_ADMIN_FAILURE: num =>
    `Whoops! There was an error adding ${num} to ${channelName}. Please try again!`,
  JOIN_SUCCESS: `You've been added to the "${channelName}" signalboost channel! Yay!`,
  JOIN_FAILURE: `Whoops! There was an error adding you to the "${channelName}" signalboost channel. Please try again!`,
  JOIN_NOOP: 'Whoops! You are already a member of that signalboost channel!',
  LEAVE_SUCCESS: `You've been removed from the "${channelName}" signalboost channel! Bye!`,
  LEAVE_FAILURE: `Whoops! There was an error removing you from the "${channelName}" signalboost channel. Please try again!`,
  LEAVE_NOOP: 'Whoops! You are not subscribed to that signalboost channel. How ya gonna leave it?',
}

// PUBLIC FUNCTIONS

const parseCommand = msg => {
  const _msg = msg.trim()
  if (_msg.match(/^add\s?admin/i))
    return { command: commands.ADD_ADMIN, payload: _msg.match(/^add\s?admin\s?(.*)/i)[1] }
  if (_msg.match(/^join$/i)) return { command: commands.JOIN }
  if (_msg.match(/^leave$/i)) return { command: commands.LEAVE }
  else return { command: commands.NOOP }
}

const execute = ({ command, payload, db, channelPhoneNumber, sender }) => {
  switch (command) {
    case commands.ADD_ADMIN:
      return maybeAddAdmin(db, channelPhoneNumber, sender, payload)
    case commands.JOIN:
      return maybeAddSubscriber(db, channelPhoneNumber, sender)
    case commands.LEAVE:
      return maybeRemoveSubscriber(db, channelPhoneNumber, sender)
    default:
      return noop()
  }
}

// PRIVATE FUNCTIONS

const maybeAddAdmin = async (db, channelPhoneNumber, sender, newAdmin) =>
  (await channelRepository.isAdmin(db, channelPhoneNumber, sender))
    ? validatePhoneNumber(newAdmin)
      ? addAdmin(db, channelPhoneNumber, sender, newAdmin)
      : Promise.resolve({
          status: statuses.SUCCESS,
          message: messages.ADD_ADMIN_NOOP_INVALID_NUMBER(newAdmin),
        })
    : Promise.resolve({ status: statuses.SUCCESS, message: messages.ADD_ADMIN_NOOP_NOT_ADMIN })

const addAdmin = (db, channelPhoneNumber, sender, newAdmin) =>
  channelRepository
    .addAdmin(db, channelPhoneNumber, newAdmin)
    .then(() => ({ status: statuses.SUCCESS, message: messages.ADD_ADMIN_SUCCESS(newAdmin) }))
    .catch(err => {
      // TODO: use logger.error
      console.error(`> ERROR adding admin: ${err}`)
      return { status: statuses.FAILURE, message: messages.ADD_ADMIN_FAILURE(newAdmin) }
    })

const maybeAddSubscriber = async (db, channelPhoneNumber, sender) => {
  const shouldAbort = await channelRepository.isSubscriber(db, channelPhoneNumber, sender)
  return shouldAbort
    ? Promise.resolve({ status: statuses.SUCCESS, message: messages.JOIN_NOOP })
    : addSubscriber(db, channelPhoneNumber, sender)
}

const addSubscriber = (db, channelPhoneNumber, sender) =>
  channelRepository
    .addSubscriber(db, channelPhoneNumber, sender)
    .then(() => ({ status: statuses.SUCCESS, message: messages.JOIN_SUCCESS }))
    .catch(err => {
      // TODO: use logger.error
      console.error(`> ERROR adding subscriber: ${err}`)
      return { status: statuses.FAILURE, message: messages.JOIN_FAILURE }
    })

const maybeRemoveSubscriber = async (db, channelPhoneNumber, sender) => {
  const shouldContinue = await channelRepository.isSubscriber(db, channelPhoneNumber, sender)
  return shouldContinue
    ? removeSubscriber(db, channelPhoneNumber, sender)
    : Promise.resolve({ status: statuses.SUCCESS, message: messages.LEAVE_NOOP })
}

const removeSubscriber = (db, channelPhoneNumber, sender) =>
  channelRepository
    .removeSubscriber(db, channelPhoneNumber, sender)
    .then(() => ({ status: statuses.SUCCESS, message: messages.LEAVE_SUCCESS }))
    .catch(err => {
      // TODO: use logger.error
      console.error(`> ERROR removing subscriber: ${err}`)
      return { status: statuses.FAILURE, message: messages.LEAVE_FAILURE }
    })

const noop = () =>
  Promise.resolve({
    status: statuses.NOOP,
    message: messages.INVALID,
  })

module.exports = { statuses, commands, messages, parseCommand, execute }
