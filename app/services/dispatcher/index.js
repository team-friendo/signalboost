const { channelPhoneNumber } = require('../../config/index')
const signal = require('./signalInterface')
const commandService = require('./command')
const messageService = require('./message')
const { statuses } = commandService

/**
 * type Dispatchable = {
 *   db: SequelizeDatabaseConnection,
 *   iface: DbusInterface,
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

const run = async db => {
  const iface = await signal.getDbusInterface()
  signal.onReceivedMessage(iface)(payload =>
    dispatch({ db, iface, channelPhoneNumber, ...payload }),
  )
}

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
    ? messageService.send(dispatchable.iface, commandResult.message, dispatchable.sender)
    : messageService.maybeBroadcast(dispatchable)
}

// EXPORTS

module.exports = { run, dispatch }
