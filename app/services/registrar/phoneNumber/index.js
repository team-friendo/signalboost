const { statuses } = require('../../../db/models/phoneNumber')
const { filters } = require('../../../db/repositories/phoneNumber')
const { errors } = require('./common')
const { list } = require('./present')
const { provisionN } = require('./provision')
const { recycle } = require('./recycle')
const { register, registerAllPurchased, registerAllUnregistered, verify } = require('./register')
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
  recycle,
  register,
  registerAllPurchased,
  registerAllUnregistered,
  verify,
}
