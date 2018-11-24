const { values, includes } = require('lodash')
const { admins, members } = require('../../data/people.js')

const isAdmin = personNumber => includes(getAdminNumbers(), personNumber)

const getAdminNumbers = () => values(admins)
const getMemberNumbers = () => values(members)

module.exports = {
  getAdminNumbers,
  getMemberNumbers,
  isAdmin,
}

