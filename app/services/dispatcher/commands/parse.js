const { map, flattenDeep, isEmpty } = require('lodash')
const { commandsByLanguage } = require('../strings/commands')
const { commands } = require('./constants')
const { defaultLanguage } = require('../../../config')

// string -> Executable
const parseExecutable = msg => {
  const { command, language, matches } = _matchOnCommand(msg) || {}
  return {
    command: command || commands.NOOP,
    language: language || defaultLanguage,
    payload: !isEmpty(matches) ? matches[2] : '',
  }
}

// string -> Array<{command: string, language: string, matches: Array<string>}>
const _matchOnCommand = msg => {
  // attempt to match on every variant of every command in every language
  // return first variant that matches (along with language and payload capturing group)
  // return null if no matches found
  const matchResults = flattenDeep(
    map(commandsByLanguage, (commands, language) =>
      map(commands, (commandStrings, command) =>
        map(commandStrings, commandStr => ({
          language,
          command,
          matches: new RegExp(`^(${commandStr})\\s?(.*)`, 'i').exec(msg.trim()),
        })),
      ),
    ),
  )
  return _pickBestMatch(matchResults)
}

const _pickBestMatch = matchResults => {
  // filter out empty matches, and return null if none found
  const hits = matchResults.filter(({ matches }) => !isEmpty(matches))
  // return the longest match (so that, eg, INVITER will get preference over INVITE)
  return isEmpty(hits) ? null : hits.sort((a, b) => b.matches[1].length - a.matches[1].length)[0]
}

module.exports = { parseExecutable }
