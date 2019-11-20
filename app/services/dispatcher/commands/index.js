const { execute } = require('./execute')
const { parseExecutable } = require('./parse')

// Dispatchable -> Promise<{dispatchable: Dispatchable, commandResult: CommandResult}>
const processCommand = dispatchable =>
  execute(parseExecutable(dispatchable.sdMessage.messageBody), dispatchable)

module.exports = { processCommand }
