const { statuses } = require('../../db/models/phoneNumber')
const { filters } = require('../../db/repositories/phoneNumber')
const { errors } = require('./common')
const { destroy } = require('./destroy')
const { list } = require('./present')
const { provisionN } = require('./provision')
const { recycle } = require('./recycle')
const { register, registerAllPurchased, registerAllUnregistered } = require('./register')
const { handleSms } = require('./sms')
const { purchase, purchaseN } = require('./purchase')

// EXPORTS

module.exports = {
  /*strings*/
  errors,
  statuses,
  filters,
  /*functions*/
  destroy,
  list,
  provisionN,
  purchase,
  purchaseN,
  recycle,
  register,
  registerAllPurchased,
  registerAllUnregistered,
  handleSms,
}
