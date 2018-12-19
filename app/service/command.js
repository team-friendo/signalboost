import channelRepository from './repository/channel'

// CONSTANTS

const statuses = {
  NOOP: 'NOOP',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
}

const commands = {
  ADD: 'ADD',
  NOOP: 'NOOP',
}

const messages = {
  INVALID: "Whoops! That's not a command!",
  ADD_SUCCESS: "You've been added to the channel! Yay!",
  ADD_FAILURE: 'Whoops! There was an error adding you to the channel. Please try again!',
  ADD_NOOP: 'Whoops! You are already a member of that channel!',
}

// PUBLIC FUNCTIONS

const parseCommand = msg => {
  const _msg = msg.trim()
  if (_msg.match(/^add$/i)) return commands.ADD
  // more match statements here...
  else return commands.NOOP
}

const execute = (command, { db, channelPhoneNumber, sender }) => {
  switch (command) {
    case commands.ADD:
      return maybeAdd(db, channelPhoneNumber, sender)
    default:
      return noop()
  }
}

// PRIVATE FUNCTIONS

const maybeAdd = async (db, channelPhoneNumber, sender) => {
  const shouldAbort = await channelRepository.isSubscriber(db, channelPhoneNumber, sender)
  return shouldAbort
    ? { status: statuses.SUCCESS, message: messages.ADD_NOOP }
    : add(db, channelPhoneNumber, sender)
}

const add = async (db, channelPhoneNumber, sender) =>
  channelRepository
    .addSubscriber(db, channelPhoneNumber, sender)
    .then(() => ({
      status: statuses.SUCCESS,
      message: messages.ADD_SUCCESS,
    }))
    .catch(() => ({
      status: statuses.FAILURE,
      message: messages.ADD_FAILURE,
    }))

const noop = () =>
  Promise.resolve({
    status: statuses.NOOP,
    message: messages.INVALID,
  })

module.exports = { statuses, commands, messages, parseCommand, execute }
