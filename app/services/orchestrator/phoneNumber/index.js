const { statuses } = require('../../../db/models/phoneNumber')
const { filters } = require('../../../db/repositories/phoneNumber')
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
  filters,
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
