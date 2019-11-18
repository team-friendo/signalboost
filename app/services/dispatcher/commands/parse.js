const { map, flattenDeep, isEmpty, find, get } = require('lodash')
const { commandsByLanguage } = require('../strings/commands')
const { commands } = require('./constants')

// TODO(aguestuser|2019-11-17): rename this parseExecutable
// string -> Executable
const parseCommand = msg => {
  const match = _findCommandMatch(msg)
  const command = get(match, 'command', commands.NOOP)
  const defaultPayload = get(match, ['matches', '1'], '')
  return {
    command,
    payload: command === commands.SET_LANGUAGE ? match.language : defaultPayload,
  }
}

// string -> {command: string, language: string, matches: Array<string>}
const _findCommandMatch = msg => {
  const matchResults = flattenDeep(
    map(commandsByLanguage, (commands, language) =>
      map(commands, (commandStrings, command) =>
        map(commandStrings, commandStr => ({
          language,
          command,
          matches: new RegExp(`^${commandStr}\\s?(.*)`, 'i').exec(msg.trim()),
        })),
      ),
    ),
  )
  return find(matchResults, ({ matches }) => !isEmpty(matches))
}

module.exports = { parseCommand }
