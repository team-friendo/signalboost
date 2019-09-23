const channelRepository = require('../../db/repositories/channel')
const signal = require('../../services/signal')
const { flattenDeep } = require('lodash')
const { statuses } = require('../../constants')
const { defaultErrorOf } = require('../util')
const { messagesIn } = require('../dispatcher/messages')
const { wait, sequence, loggerOf } = require('../util')
const logger = loggerOf('safetyNumberService')
const {
  defaultLanguage,
  signal: { resendDelay },
} = require('../../config')
const {
  messages: { trust: trustMessages },
} = signal

/*******************************************************
 * type TrustResponse = {
 *   status: "SUCCESS" | "ERROR"
 *   message: string,
 * }
 *
 * type TrustTally = {
 *   successes: number,
 *   errors: number,
 *   noops: number,
 * }
 ******************************************************/

// (Socket, Channel, string, string) -> Promise<void>
const triggerTrust = (sock, channelPhoneNumber, memberPhoneNumber, language) => {
  const trustMessages = messagesIn(language).trust
  return signal
    .sendMessage(
      sock,
      memberPhoneNumber,
      sdMessageOf(
        { phoneNumber: channelPhoneNumber },
        messagesIn(language).notifications.safetyNumberReset(channelPhoneNumber),
      ),
    )
    .then(() => ({
      status: statuses.SUCCESS,
      message: trustMessages.success(memberPhoneNumber),
    }))
    .catch(() => ({
      status: statuses.ERROR,
      message: trustMessages.error(memberPhoneNumber),
    }))
}

// (Database, Socket, string, SdMessage) -> Promise<TrustTally>
const trustAndResend = async (db, sock, phoneNumber, sdMessage) => {
  try {
    const trustResults = await trust(db, sock, phoneNumber)
    await wait(resendDelay).then(() => signal.sendMessage(sock, phoneNumber, sdMessage))
    return trustResults
  } catch (e) {
    return defaultErrorOf(e)
  }
}

// (Database, Socket) -> Promise<TrustTally>
const trust = async (db, sock, phoneNumber) => {
  try {
    const { publications, subscriptions } = await channelRepository.findMemberships(db, phoneNumber)
    const trustResponses = await issueManyTrustCommands(sock, publications, subscriptions)
    return tallyResults(trustResponses)
  } catch (e) {
    logger.error(`Error adding safety number for ${phoneNumber}: ${e}`)
    return { successes: 0, errors: 1, noops: 0 }
  }
}

// TODO(aguestuser|2019-09-21):
//  it would be easier to write logic like this if we had a `memberships` table
//  instead of separate subscriptions/publications tables.
//  then we wouldn't have to write two separate branches with highly duplicated logic here!
//  also: `memberships` is a more intuitive concept that `subscriptions` or `publications`

// (Socket, Array<Publication>, Array<Subscription>) -> Promise<TrustResponse>
const issueManyTrustCommands = (sock, publications, subscriptions) =>
  // impose a 1 sec delay between safety-number trustings/notifications to avoid signal rate-limiting
  sequence(
    publications
      .map(({ channelPhoneNumber, publisherPhoneNumber }) => () =>
        issueTrustCommand(sock, channelPhoneNumber, publisherPhoneNumber),
      )
      .concat(
        subscriptions.map(({ channelPhoneNumber, subscriberPhoneNumber }) => () =>
          issueTrustCommand(sock, channelPhoneNumber, subscriberPhoneNumber),
        ),
      ),
    resendDelay,
  ).then(flattenDeep)

// yes, this is gross! (let's refactor to use memberships instead of needing this!)
const issueTrustCommand = async (sock, channelPhoneNumber, memberPhoneNumber) => {
  const trustResult = await signal
    .trust(sock, channelPhoneNumber, memberPhoneNumber)
    .then(successStatus => {
      logger.log(successStatus.message)
      return successStatus
    })
    .catch(errorStatus => {
      logger.log(errorStatus.message)
      return errorStatus
    })
  try {
    await notifyMember(sock, channelPhoneNumber, memberPhoneNumber)
    return Promise.resolve(trustResult)
  } catch (e) {
    const message = trustMessages.notifyError(channelPhoneNumber, memberPhoneNumber)
    logger.log(message)
    return { status: statuses.ERROR, message }
  }
}

const notifyMember = (sock, channelPhoneNumber, memberPhoneNumber) =>
  signal.sendMessage(
    sock,
    memberPhoneNumber,
    sdMessageOf(
      { phoneNumber: channelPhoneNumber },
      messagesIn(defaultLanguage).notifications.safetyNumberReset(channelPhoneNumber),
    ),
  )

// TODO(aguestuser|2019-09-22)
//  extract this to util so it can be used both here and in messenger w/o circular dependency!
const sdMessageOf = (channel, messageBody) => ({
  type: signal.messageTypes.SEND,
  username: channel.phoneNumber,
  messageBody,
})

// (Array<TrustResponse>) -> TrustTally
const tallyResults = trustResponses =>
  trustResponses.reduce(
    (acc, resp) => ({
      successes: resp.status === statuses.SUCCESS ? acc.successes + 1 : acc.successes,
      errors: resp.status === statuses.ERROR ? acc.errors + 1 : acc.errors,
      noops: resp.status === statuses.NOOP ? acc.noops + 1 : acc.noops,
    }),
    {
      successes: 0,
      errors: 0,
      noops: 0,
    },
  )

module.exports = { triggerTrust, trustAndResend, trust }
