const { languages } = require('../../../constants')

const messagesIn = lang => {
  switch(lang) {
    case languages.EN:
      return require('./EN')
    default:
      return {}
  }
}

module.exports = {
  messagesIn,
}
