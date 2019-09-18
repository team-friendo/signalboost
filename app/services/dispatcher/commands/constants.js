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
  TOGGLE_RESPONSES: 'TOGGLE_RESPONSES',
}

module.exports = { statuses, commands }
