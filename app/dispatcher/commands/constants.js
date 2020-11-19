const statuses = {
  NOOP: 'NOOP',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
}

const vouchModes = {
  ON: 'ON',
  OFF: 'OFF',
  ADMIN: 'ADMIN',
}

const toggles = {
  HOTLINE: { dbField: 'hotlineOn', name: 'hotline' },
}

const parseErrorTypes = {
  MISSING_COMMAND: 'MISSING_COMMAND',
  NON_EMPTY_PAYLOAD: 'NON_EMPTY_PAYLOAD',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
}

const commands = {
  ADD: 'ADD',
  ACCEPT: 'ACCEPT',
  BROADCAST: 'BROADCAST',
  DECLINE: 'DECLINE',
  DESTROY: 'DESTROY',
  DESTROY_CONFIRM: 'DESTROY_CONFIRM',
  HELP: 'HELP',
  HOTLINE_OFF: 'HOTLINE_OFF',
  HOTLINE_ON: 'HOTLINE_ON',
  INFO: 'INFO',
  INVITE: 'INVITE',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  NONE: 'NONE',
  PRIVATE: 'PRIVATE',
  REMOVE: 'REMOVE',
  REPLY: 'REPLY',
  RESTART: 'RESTART',
  SET_LANGUAGE: 'SET_LANGUAGE',
  VOUCH_LEVEL: 'VOUCH_LEVEL',
  VOUCHING_ON: 'VOUCHING_ON',
  VOUCHING_OFF: 'VOUCHING_OFF',
  VOUCHING_ADMIN: 'VOUCHING_ADMIN',
}

module.exports = { statuses, toggles, commands, vouchModes, parseErrorTypes }
