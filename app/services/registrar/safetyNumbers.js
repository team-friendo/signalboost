const channelRepository = require('../../db/repositories/channel')
const signal = require('../../services/signal')
const { flattenDeep, identity, partition } = require('lodash')
const { statuses } = require('../../constants')

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
    const trustResponses = await sendTrustMessages(sock, channels)
    return tallyResults(trustResponses)
  } catch (e) {
    return {
      status: statuses.ERROR,
      message: e.message,
    }
  }
}

// (Socket, Array<Channel>) -> Promise<TrustResponse>
const sendTrustMessages = (sock, channels) =>
  Promise.all(
    (channels || []).map(ch =>
      Promise.all([
        Promise.all(
          ch.subscriptions.map(sub =>
            signal.trust(sock, sub.channelPhoneNumber, sub.subscriberPhoneNumber).catch(identity),
          ),
        ),
        Promise.all(
          ch.publications.map(pub =>
            signal.trust(sock, pub.channelPhoneNumber, pub.publisherPhoneNumber).catch(identity),
          ),
        ),
      ]),
    ),
  ).then(flattenDeep)

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

module.exports = { trustAll }
