const purchase = require('./purchase')
const register = require('./register')
const { find } = require('lodash')
const { statuses } = require('./common')

const provisionN = ({ db, sock, areaCode, n }) =>
  purchase
    .purchaseN({ db, areaCode, n })
    .then(purchaseStatuses => maybeRegisterAll({ db, sock, purchaseStatuses }))

const maybeRegisterAll = ({ db, sock, purchaseStatuses }) =>
  find(purchaseStatuses, ({ status }) => status === statuses.ERROR)
    ? purchaseStatuses
    : register.registerAllPurchased({ db, sock })

module.exports = { provisionN }
