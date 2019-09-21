const { languages } = require('../../../constants')
const { defaultLanguage } = require('../../../config')

const messagesIn = lang => {
  switch (lang) {
    case languages.EN:
      return require('./EN')
    default:
      return require(`./${defaultLanguage}`)
  }
}

module.exports = {
  messagesIn,
}
