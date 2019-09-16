const { values } = require('lodash')
const { languages } = require('../../../constants')

const messagesIn = lang => (_isValid(lang) ? require(`./${lang}`) : {})
const _isValid = lang => values(languages).includes(lang)

module.exports = {
  messagesIn,
}
