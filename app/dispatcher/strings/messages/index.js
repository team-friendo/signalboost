const { defaultLanguage } = require('../../../config')
const { languages } = require('../../../language')

const messagesIn = lang => {
  switch (lang) {
    case languages.EN:
      return require('./EN')
    case languages.ES:
      return require('./ES')
    case languages.FR:
      return require('./FR')
    case languages.DE:
      return require('./DE')
    default:
      return require(`./${defaultLanguage}`)
  }
}

module.exports = {
  messagesIn,
}
