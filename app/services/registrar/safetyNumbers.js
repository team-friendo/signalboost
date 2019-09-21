const channelRepository = require('../../db/repositories/channel')
const signal = require('../../services/signal')
const { flattenDeep, identity, partition } = require('lodash')
const { statuses } = require('../../constants')
const { defaultErrorOf } = require('../util')

/*******************************************************
 * type TrustResponse = {
 *   status: "SUCCESS" | "ERROR"
 *   message: string // trustSuccess(string) | trustError(string)
 * }
 *
 * type TrustTally = {
 *   successes: number,
 *   errors: number
 * }
 ******************************************************/

// (Database, Socket) -> Promise<TrustTally>
const trustAll = async (db, sock) => {
  try {
    const channels = await channelRepository.findAllDeep(db)
    const [publications, subscriptions] = channels.reduce(
      ([pubs, subs], ch) => [pubs.concat(ch.publications), subs.concat(ch.subscriptions)],
      [[], []],
    )
    const trustResponses = await sendTrustMessages(sock, publications, subscriptions)
    return tallyResults(trustResponses)
  } catch (e) {
    return defaultErrorOf(e)
  }
}

// (Database, Socket) -> Promise<TrustTally>
const trustAllForMember = async (db, sock, memberPhoneNumber) => {
  try {
    const { publications, subscriptions } = await channelRepository.findMembershipsByPhoneNumber(
      db,
      memberPhoneNumber,
    )
    const trustResponses = await sendTrustMessages(sock, publications, subscriptions)
    return tallyResults(trustResponses)
  } catch (e) {
    return defaultErrorOf(e)
  }
}

// TODO(aguestuser|2019-09-21):
//  it would be easier to write logic like this if we had a `memberships` table
//  instead of separate subscriptions/publications tables
//  also: `memberships` is a more intuitive concept that `subscriptions` or `publications`
// (Socket, Array<Publication>, Array<Subscription>) -> Promise<TrustResponse>
const sendTrustMessages = (sock, publications, subscriptions) =>
  Promise.all([
    Promise.all(
      subscriptions.map(sub =>
        signal.trust(sock, sub.channelPhoneNumber, sub.subscriberPhoneNumber).catch(identity),
      ),
    ),
    Promise.all(
      publications.map(pub =>
        signal.trust(sock, pub.channelPhoneNumber, pub.publisherPhoneNumber).catch(identity),
      ),
    ),
  ]).then(flattenDeep)

// (Array<TrustResponse>) -> TrustTally
const tallyResults = trustResponses => {
  const [successes, errors] = partition(trustResponses, resp => resp.status === statuses.SUCCESS)
  return { successes: successes.length, errors: errors.length }
}

//
// .catch(e => ({
//   status: statuses.ERROR,
//   message: e.message,
// }))

module.exports = { trustAll, trustAllForMember }
