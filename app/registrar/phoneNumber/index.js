const { statuses } = require('../../db/models/phoneNumber')
const { filters } = require('../../db/repositories/phoneNumber')
const { errors } = require('./common')
const { list } = require('./present')
const { provisionN } = require('./provision')
const { destroy, requestToDestroy, processDestructionRequests, redeem } = require('./destroy')
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
  processDestructionRequests,
  requestToDestroy,
  redeem,
  register,
  registerAllPurchased,
  registerAllUnregistered,
  handleSms,
}
