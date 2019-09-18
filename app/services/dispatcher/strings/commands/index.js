const { pick } = require('lodash')
const languages = require('../../../../constants')
const commandStringsEN = require('./EN')
const commandStringsES = require('./ES')

const ALL = [commandStringsEN, commandStringsES]

const commandStringsIn = lang => {
  switch (lang) {
    case languages.EN:
      return commandStringsEN
    case languages.ES:
      return commandStringsES
  }
}

const allVariantsOf = command => ALL.map(commandsInLang => pick(commandsInLang, [command]))
// const parseMatchedVariantAndLang = (string, command) =>


module.exports = { commandStringsIn, allVariantsOf }
