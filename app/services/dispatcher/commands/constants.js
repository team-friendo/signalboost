const statuses = {
  NOOP: 'NOOP',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
}

const toggles = {
  HOTLINE: { dbField: 'hotlineOn', name: 'hotline' },
  VOUCHING: { dbField: 'vouchingOn', name: 'vouching' },
}

const commands = {
  ADD: 'ADD',
  ACCEPT: 'ACCEPT',
  DECLINE: 'DECLINE',
  HELP: 'HELP',
  INFO: 'INFO',
  INVITE: 'INVITE',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  NOOP: 'NOOP',
  REMOVE: 'REMOVE',
  RENAME: 'RENAME',
  HOTLINE_OFF: 'HOTLINE_OFF',
  HOTLINE_ON: 'HOTLINE_ON',
  SET_LANGUAGE: 'SET_LANGUAGE',
  VOUCHING_ON: 'VOUCHING_ON',
  VOUCHING_OFF: 'VOUCHING_OFF',
  SET_DESCRIPTION: 'SET_DESCRIPTION',
}

module.exports = { statuses, toggles, commands }
