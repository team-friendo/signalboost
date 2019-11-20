const { map, flattenDeep, isEmpty, find, get } = require('lodash')
const { commandsByLanguage } = require('../strings/commands')
const { commands } = require('./constants')
const { defaultLanguage } = require('../../../config')

// TODO(aguestuser|2019-11-17): rename this parseExecutable
// string -> Executable
const parseCommand = msg => {
  const { command, language, matches } = _findCommandMatch(msg) || {}
  return {
    command: command || commands.NOOP,
    language: language || defaultLanguage,
    payload: !isEmpty(matches) ? matches[1] : '',
  }
}

// string -> {command: string, language: string, matches: Array<string>}
const _findCommandMatch = msg => {
  // attempt to match on every variant of every command in every language
  // return first variant that matches (along with language and payload capturing group)
  // return null if no matches found
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
