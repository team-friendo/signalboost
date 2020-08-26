const app = require('../../../app')
const { eventTypes } = require('../models/event')
const { sha256Hash } = require('../../util')

// (string, string, sequelize.Transaction | null) => Promise<Event>
const log = (eventType, phoneNumber, transaction = null) =>
  app.db.event.create({
    type: eventType,
    phoneNumberHash: sha256Hash(phoneNumber),
    // omit the transaction k/v pair if no transaction arg provided
    ...(transaction ? { transaction } : {}),
  })

// string => Promise<Event|null>
const logIfFirstMembership = async memberPhoneNumber => {
  // NOTE: this function should be called AFTER creating a membership
  const isFirst = (await app.db.membership.count({ where: { memberPhoneNumber } })) === 1
  return isFirst ? log(eventTypes.MEMBER_CREATED) : null
}

// string => Promise<Event|null>
const logIfLastMembership = async memberPhoneNumber => {
  // NOTE: this function should be called AFTER creating a membership
  const isLast = (await app.db.membership.count({ where: { memberPhoneNumber } })) === 0
  return isLast ? log(eventTypes.MEMBER_DESTROYED) : null
}

module.exports = { log, logIfFirstMembership, logIfLastMembership }
