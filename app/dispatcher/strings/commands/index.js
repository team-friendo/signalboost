const { languages } = require('../../../language')
const commandStringsEN = require('./EN')
const commandStringsES = require('./ES')
const commandStringsFR = require('./FR')
const commandStringsDE = require('./DE')

// const ALL = [commandStringsEN, commandStringsES]

const commandsByLanguage = {
  [languages.EN]: commandStringsEN,
  [languages.ES]: commandStringsES,
  [languages.FR]: commandStringsFR,
  [languages.DE]: commandStringsDE,
}

module.exports = { commandsByLanguage }
