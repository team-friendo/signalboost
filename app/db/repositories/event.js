const app = require('../../../app')
const metrics = require('../../metrics')
const { counters, loadEvents } = metrics
const { eventTypes } = require('../models/event')
const { sha256Hash } = require('../../util')

// (string, string, object, sequelize.Transaction | null) => Promise<Event>
const log = (eventType, phoneNumber, metadata = undefined, transaction = undefined) =>
  app.db.event.create(
    {
      type: eventType,
      phoneNumberHash: sha256Hash(phoneNumber),
      metadata,
    },
    {
      transaction,
    },
  )

// string => Promise<Event|null>
const logIfFirstMembership = async memberPhoneNumber => {
  // NOTE: this function should be called AFTER creating a membership
  const isFirst = (await app.db.membership.count({ where: { memberPhoneNumber } })) === 1
  if (!isFirst) return null
  metrics.incrementCounter(counters.SYSTEM_LOAD, [loadEvents.MEMBER_CREATED])
  return log(eventTypes.MEMBER_CREATED, memberPhoneNumber)
}

// string => Promise<Event|null>
const logIfLastMembership = async memberPhoneNumber => {
  // NOTE: this function should be called AFTER creating a membership
  const isLast = (await app.db.membership.count({ where: { memberPhoneNumber } })) === 0
  if (!isLast) return null
  metrics.incrementCounter(counters.SYSTEM_LOAD, [loadEvents.MEMBER_DESTROYED])
  return log(eventTypes.MEMBER_DESTROYED, memberPhoneNumber)
}

/**
 * GOTCHA w.r.t. implementation of membership creation/destruction event log:
 * - when querying the events log to count unique users, it would be tempting
 *   to simply look for a member created event and count that as a unique user
 * - however, it might be the case that a member is created and destroyed, then created again
 *   causing the same user to have two member created events
 * - in this case, the metrics implementer should query for MEMBER_CREATED records with distinct
 *   phoneNumberHash fields (which will collapse multiple member created events for the same user
 *   into one record)
 * - note that we elect to do this rather than simply delete the MEMBER_DESTROYED event when the
 *   member re-joins because modeling this usage pattern as multiple created/destroyed lifetimes
 *   for a given user, more precisely represents how they were engaging with the app
 ***/

module.exports = { log, logIfFirstMembership, logIfLastMembership }
