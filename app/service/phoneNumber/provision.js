const purchase = require('./purchase')
const register = require('./register')
const { find } = require('lodash')
const { statuses } = require('./common')

const provisionN = ({ db, emitter, areaCode, n }) =>
  purchase
    .purchaseN({ db, areaCode, n })
    .then(purchaseStatuses => maybeRegisterAll({ db, emitter, purchaseStatuses }))

const maybeRegisterAll = ({ db, emitter, purchaseStatuses }) =>
  find(purchaseStatuses, ({ status }) => status === statuses.ERROR)
    ? purchaseStatuses
    : register.registerAll({ db, emitter })

module.exports = { provisionN }
