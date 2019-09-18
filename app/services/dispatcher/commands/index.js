const { execute } = require('./execute')
const { parseCommand } = require('./parse')

// Dispatchable -> Promise<{dispatchable: Dispatchable, commandResult: CommandResult}>
const processCommand = dispatchable =>
  execute(parseCommand(dispatchable.sdMessage.messageBody), dispatchable)

module.exports = { processCommand }
