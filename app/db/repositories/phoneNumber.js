const { Op } = require('sequelize')
const { statuses } = require('../models/phoneNumber')
const validations = require('../validations/phoneNumber')

const filters = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
}

const findAll = db => db.phoneNumber.findAll()

const findAllPurchased = db => db.phoneNumber.findAll({ where: { status: statuses.PURCHASED } })

const list = (db, filter) =>
  db.phoneNumber.findAll({ order: [['status', 'DESC']], where: parseQueryFilter(filter) })

const parseQueryFilter = filter => {
  switch (filter) {
    case filters.ACTIVE:
      return { status: statuses.ACTIVE }
    case filters.INACTIVE:
      return { status: { [Op.not]: statuses.ACTIVE } }
    default:
      return {}
  }
}

const update = (db, phoneNumber, attrs) =>
  db.phoneNumber
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([_, [pNumInstance]]) => pNumInstance)

module.exports = { filters, findAll, findAllPurchased, list, update }
