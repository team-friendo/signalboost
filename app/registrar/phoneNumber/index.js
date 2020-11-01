const { statuses } = require('../../db/models/phoneNumber')
const { filters } = require('../../db/repositories/phoneNumber')
const { errors } = require('./common')
const { list } = require('./present')
const { provisionN } = require('./provision')
const {
  deleteVestigalKeystoreEntries,
  destroy,
  requestToDestroy,
  requestToDestroyStaleChannels,
  processDestructionRequests,
  redeem,
} = require('./destroy')
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
  deleteVestigalKeystoreEntries,
  destroy,
  list,
  provisionN,
  purchase,
  purchaseN,
  processDestructionRequests,
  redeem,
  register,
  registerAllPurchased,
  registerAllUnregistered,
  requestToDestroy,
  requestToDestroyStaleChannels,
  handleSms,
}
