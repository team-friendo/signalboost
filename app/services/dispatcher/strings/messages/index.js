const { defaultLanguage } = require('../../../../config')
const { languages } = require('../../../../constants')

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
