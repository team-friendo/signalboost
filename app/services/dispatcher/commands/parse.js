const { map, flattenDeep, isEmpty, get } = require('lodash')
const { commandsByLanguage } = require('../strings/commands')
const { commands } = require('./constants')
const validator = require('../../../db/validations/phoneNumber')
const { messagesIn } = require('../strings/messages')
const {
  defaultLanguage,
  signal: { maxVouchLevel },
} = require('../../../config')

/**
 *
 * ExecutableOrParseError = Executable | ParseError
 *
 * type Executable = {
 *   command: string,
 *   payload: string | HotlineReply,
 *   language: 'EN' | 'ES' | 'FR'
 * }
 *
 * type HotlineReply {
 *   messageId: number,
 *   reply: string,
 * }
 *
 * type ParseError = {
 *   command: string,
 *   payload: string,
 *   error: string,
 * }
 *
 * type CommandMatch = {
 *   command: string,
 *   language: string,
 *   matches: Array<string | Array<string>>
 * }
 *
 * `error` field shows an error string if a payload validation fails, is null otherwise
 *
 * `matches` field is the result of command regex applied to an input message
 * - if regex matches, it an array containing the matched message, followed by capturing groups
 * - if regex does not match, it is null
 *
 **/

// string -> ParseExecutableResult
const parseExecutable = msg => {
  const { command, language, error, matches } = findCommandMatch(msg) || {}
  const payload = !isEmpty(matches) ? matches[2] : ''
  return error ? { command, payload, error } : { command, payload, language }
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
          matches: new RegExp(`^(${commandStr})[.|!]*\\s?([^]*)`, 'i').exec(msg.trim()),
        })),
      ),
    ),
  )
  return validatePayload(pickLongestMatch(matchResults))
}

// Array<CommandMatch> -> CommandMatch
const pickLongestMatch = matchResults => {
  // filter out empty matches, and return NOOP if none found
  // return the longest match (so that, eg, INVITER will get preference over INVITE)
  const hits = matchResults.filter(({ matches }) => !isEmpty(matches))
  return isEmpty(hits)
    ? { command: commands.NOOP, language: defaultLanguage }
    : hits.sort((a, b) => b.matches[1].length - a.matches[1].length)[0]
}

// CommandMatch -> CommandMatch
const validatePayload = commandMatch => {
  switch (get(commandMatch, 'command')) {
    case commands.ACCEPT:
    case commands.DECLINE:
    case commands.DESTROY:
    case commands.DESTROY_CONFIRM:
    case commands.HELP:
    case commands.HOTLINE_ON:
    case commands.HOTLINE_OFF:
    case commands.INFO:
    case commands.JOIN:
    case commands.LEAVE:
    case commands.SET_LANGUAGE:
    case commands.VOUCHING_ON:
    case commands.VOUCHING_OFF:
      return validateNoPayload(commandMatch)
    case commands.ADD:
    case commands.REMOVE:
      return validatePhoneNumber(commandMatch)
    case commands.INVITE:
      return validatePhoneNumberList(commandMatch)
    case commands.VOUCH_LEVEL:
      return validateVouchLevel(commandMatch)
    case commands.REPLY:
      return validateMessageId(commandMatch)
    default:
      return commandMatch
  }
}

// CommandMatch -> CommandMatch
const validateNoPayload = commandMatch => {
  // substitutes a NOOP command (signaling a broadcast message) if payload found for a no-payload command
  // so that (e.g) "hello everyone on the channel!" is not interpreted as a command
  const { language, matches } = commandMatch
  return isEmpty(matches[2]) ? commandMatch : { command: commands.NOOP, language, matches: [] }
}

// CommandMatch -> CommandMatch | ParseError
const validatePhoneNumber = commandMatch => {
  // tries to parse a valid e164 phone number...
  // - returns commandMatch with valid/parsed number if it can
  // - returns parse error if it cannot
  const { command, language, matches } = commandMatch
  const parseErrors = messagesIn(language).parseErrors

  const rawPhoneNumber = matches[2]
  const { phoneNumber } = validator.parseValidPhoneNumber(rawPhoneNumber)

  return !phoneNumber
    ? { command, matches, error: parseErrors.invalidPhoneNumber(rawPhoneNumber) }
    : { command, language, matches: [...matches.slice(0, 2), phoneNumber] }
}

// CommandMatch -> CommandMatch | ParseError
const validatePhoneNumberList = commandMatch => {
  const { command, language, matches } = commandMatch
  const parseErrors = messagesIn(language).parseErrors

  const rawPhoneNumbers = matches[2].replace(/\s/g, '').split(',')
  const parsedPhoneNumbers = rawPhoneNumbers.map(validator.parseValidPhoneNumber)
  const invalidNumbers = parsedPhoneNumbers.filter(pn => !pn.phoneNumber).map(pn => pn.input)

  if (invalidNumbers.length > 1) {
    return { command, matches, error: parseErrors.invalidPhoneNumbers(invalidNumbers) }
  }
  if (invalidNumbers.length === 1) {
    return { command, matches, error: parseErrors.invalidPhoneNumber(invalidNumbers[0]) }
  }
  return {
    command,
    language,
    matches: [...matches.slice(0, 2), parsedPhoneNumbers.map(pn => pn.phoneNumber)],
  }
}

// CommandMatch -> CommandMatch | ParseError
const validateVouchLevel = commandMatch => {
  const { command, language, matches } = commandMatch
  const parseErrors = messagesIn(language).parseErrors

  const vouchLevel = Number(matches[2])
  const isValidVouchLevel =
    Number.isInteger(vouchLevel) && vouchLevel > 0 && vouchLevel <= maxVouchLevel

  return !isValidVouchLevel
    ? { command, matches, error: parseErrors.invalidVouchLevel(matches[2]) }
    : commandMatch
}

// CommandMatch -> CommandMatch | ParseError
const validateMessageId = commandMatch => {
  const { command, language, matches } = commandMatch
  const parseErrors = messagesIn(language).parseErrors

  const payload = matches[2]
  const validationMatches = new RegExp(`^#(\\d+)(.*)`, 'i').exec(payload.trim())

  return isEmpty(validationMatches)
    ? { command, matches, error: parseErrors.invalidHotlineMessageId(payload) }
    : {
        ...commandMatch,
        matches: [
          null,
          null,
          { messageId: parseInt(validationMatches[1]), reply: validationMatches[2].trim() },
        ],
      }
}

module.exports = { parseExecutable }
