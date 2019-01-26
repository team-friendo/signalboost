const { channelPhoneNumber } = require('../../config/index')
const signal = require('../signalInterface')
const commandService = require('./command')
const messageService = require('./message')
const { statuses } = commandService

/**
 * type Dispatchable = {
 *   db: SequelizeDatabaseConnection,
 *   channelPhoneNumber: string,
 *   message: string,
 *   sender: string,
 *   attachments: string,
 * }
 */

/**
 * type CommandResult = {
 *   status: string
 *   message: string,
 * }
 */

// MAIN FUNCTIONS

const run = db =>
  signal.onReceivedMessage(payload => dispatch({ db, channelPhoneNumber, ...payload }))

const dispatch = async dispatchable => {
  console.log(`[${new Date().toISOString()}] Dispatching message on channel: ${channelPhoneNumber}`)
  return processMessages(await processCommands(dispatchable), dispatchable)
}

// HELPERS

// Dispatchable -> Promise<CommandResult>
const processCommands = dispatchable =>
  commandService.execute(commandService.parseCommand(dispatchable.message), dispatchable)

// CommandResult -> Promise<void>
const processMessages = (commandResult, dispatchable) => {
  return commandResult.status !== statuses.NOOP
    ? messageService.send(commandResult.message, dispatchable.sender)
    : messageService.maybeBroadcast(dispatchable)
}

// EXPORTS

module.exports = { run, dispatch }
