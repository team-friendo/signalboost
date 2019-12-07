const { languages } = require('../../../../constants')
const commandStringsEN = require('./EN')
const commandStringsES = require('./ES')
const commandStringsFR = require('./FR')

// const ALL = [commandStringsEN, commandStringsES]

const commandsByLanguage = {
  [languages.EN]: commandStringsEN,
  [languages.ES]: commandStringsES,
  [languages.FR]: commandStringsFR,
}

module.exports = { commandsByLanguage }
