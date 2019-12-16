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
  INVITE: 'INVITE',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  NOOP: 'NOOP',
  REMOVE: 'REMOVE',
  RENAME: 'RENAME',
  RESPONSES_OFF: 'RESPONSES_OFF',
  RESPONSES_ON: 'RESPONSES_ON',
  SET_LANGUAGE: 'SET_LANGUAGE',
  VOUCHING_ON: 'VOUCHING_ON',
  VOUCHING_OFF: 'VOUCHING_OFF',
}

module.exports = { statuses, commands }
