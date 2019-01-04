const { statuses } = require('../../db/models/phoneNumber')
const { errors } = require('./common')
const { register, verify } = require('./register')
const { purchase } = require('./purchase')

// EXPORTS

module.exports = {
  statuses,
  errors,
  register,
  purchase,
  verify,
}
