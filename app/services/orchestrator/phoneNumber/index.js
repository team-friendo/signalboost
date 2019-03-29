const { statuses } = require('../../../db/models/phoneNumber')
const { errors } = require('./common')
const { list } = require('./present')
const { provisionN } = require('./provision')
const { register, registerAll, registerAllUnregistered, verify } = require('./register')
const { purchase, purchaseN } = require('./purchase')

// EXPORTS

module.exports = {
  /*strings*/
  errors,
  statuses,
  /*functions*/
  list,
  provisionN,
  purchase,
  purchaseN,
  register,
  registerAll,
  registerAllUnregistered,
  verify,
}
