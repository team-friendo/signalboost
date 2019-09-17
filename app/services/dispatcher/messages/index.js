const { languages } = require('../../../constants')
const { defaultLanguage } = require('../../../config')

const messagesIn = lang => {
  switch (lang) {
    case languages.EN:
      return require('./EN')
    case languages.ES:
      return require('./ES')
    default:
      return require(`./${defaultLanguage}`)
  }
}

module.exports = {
  messagesIn,
}
