const { languages } = require('../../../../constants')
const commandStringsEN = require('./EN')
const commandStringsES = require('./ES')

// const ALL = [commandStringsEN, commandStringsES]

const commandsByLanguage = {
  [languages.EN]: commandStringsEN,
  [languages.ES]: commandStringsES,
}

module.exports = { commandsByLanguage }
