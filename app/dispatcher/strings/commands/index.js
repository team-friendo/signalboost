const { languages } = require('../../../language')
const commandStringsEN = require('./EN')
const commandStringsES = require('./ES')
const commandStringsFR = require('./FR')
const commandStringsDE = require('./DE')
const { flatten, mapValues, values } = require('lodash')

// const ALL = [commandStringsEN, commandStringsES]

const commandsByLanguage = {
  [languages.EN]: commandStringsEN,
  [languages.ES]: commandStringsES,
  [languages.FR]: commandStringsFR,
  [languages.DE]: commandStringsDE,
}

// (string, string) -> boolean
const isCommand = (str, command) => {
  // predicate to tell whether a string matches all the various translations of a given command
  const translations = flatten(
    values(
      mapValues(commandsByLanguage, commandStringsByCommand => commandStringsByCommand[command]),
    ),
  )
  return translations.includes(str)
}
module.exports = { commandsByLanguage, isCommand }
