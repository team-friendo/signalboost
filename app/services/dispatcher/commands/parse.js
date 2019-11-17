const { map, flattenDeep, isEmpty, find, get } = require('lodash')
const { commandsByLanguage } = require('../strings/commands')
const { commands } = require('./constants')
const { defaultLanguage } = require('../../../config')

// TODO(aguestuser|2019-11-17): rename this parseExecutable
// string -> Executable
const parseCommand = msg => {
  const matchResults = _findCommandMatches(msg)
  const matched = find(matchResults, ({ matches }) => !isEmpty(matches))
  // TODO(aguestuser|2019-11-17):
  //  instead of returning language here, only use it to determine payload of a SET_LANGUAGE command
  return {
    command: get(matched, 'command', commands.NOOP),
    language: get(matched, 'language', defaultLanguage),
    payload: get(matched, ['matches', '1'], ''),
  }
}

// string -> Array<{command: string, language: string, matches: Array<string>}>
const _findCommandMatches = msg =>
  flattenDeep(
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

module.exports = { parseCommand }
