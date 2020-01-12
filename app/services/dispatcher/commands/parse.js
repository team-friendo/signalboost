const { map, flattenDeep, isEmpty, get } = require('lodash')
const { commandsByLanguage } = require('../strings/commands')
const { commands } = require('./constants')
const { defaultLanguage } = require('../../../config')

/**
 * type CommandMatch = {
 *   command: string,
 *   language: string,
 *   matches: Array<string>?
 * }
 *
 * `matches` field is the result of command regex applied to an input message
 * - if regex matches, it an array containing the matched message, followed by capturing groups
 * - if regex does not match, it is null
 *
 **/

// string -> Executable
const parseExecutable = msg => {
  const { command, language, matches } = findCommandMatch(msg) || {}
  return {
    command: command || commands.NOOP,
    language: language || defaultLanguage,
    payload: !isEmpty(matches) ? matches[2] : '',
  }
}

// string -> CommandMatch
const findCommandMatch = msg => {
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
  return validatePayload(pickLongestMatch(matchResults))
}

// Array<CommandMatch> -> CommandMatch
const pickLongestMatch = matchResults => {
  // filter out empty matches, and return null if none found
  const hits = matchResults.filter(({ matches }) => !isEmpty(matches))
  // return the longest match (so that, eg, INVITER will get preference over INVITE)
  return isEmpty(hits) ? null : hits.sort((a, b) => b.matches[1].length - a.matches[1].length)[0]
}

// CommandMatch -> CommandMatch
const validatePayload = commandMatch => {
  switch (get(commandMatch, 'command')) {
    case commands.ACCEPT:
    case commands.DECLINE:
    case commands.HELP:
    case commands.INFO:
    case commands.JOIN:
    case commands.LEAVE:
    case commands.SET_LANGUAGE:
      return validateNoPayload(commandMatch)
    default:
      return commandMatch
  }
}

const validateNoPayload = commandMatch => {
  const { language, matches } = commandMatch
  return isEmpty(matches[2]) ? commandMatch : { command: commands.NOOP, language, matches: null }
}

module.exports = { parseExecutable }
