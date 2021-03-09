const channelRepository = require('./db/repositories/channel')
const app = require('../app')
const util = require('./util')
const signal = require('./signal')
const { messageTypes } = require('./signal/constants')
const metrics = require('./metrics')
const notifier = require('./notifier')
const { isEmpty } = require('lodash/lang')
const { times, filter, map, partition, zip, groupBy, mapValues, head } = require('lodash')
const { sdMessageOf } = require('./signal/constants')
const {
  signal: { diagnosticsPhoneNumber, healthcheckSpacing, healthcheckTimeout, restartDelay },
  socket: { availableSockets },
} = require('./config')

const logger = util.loggerOf('diagnostics')

// Set<string>
const failedHealthchecks = new Set()

// () => Promise<string>
const sendHealthchecks = async () => {
  logger.log('Healthcheck job running...')

  try {
    const [[diagnosticsChannel], channels] = partition(
      await channelRepository.findAllHealthcheckable(),
      channel => channel.phoneNumber === diagnosticsPhoneNumber,
    )

    logger.log(`Sending ${channels.length} healthchecks...`)
    const responseTimes = await util.sequence(
      channels.map(({ phoneNumber }) => () =>
        signal.healthcheck(phoneNumber, diagnosticsChannel.socketId),
      ),
      healthcheckSpacing,
    )
    logger.log(`Received responses for ${responseTimes.length} healthchecks.`)

    const fatalHealtcheckFailures = map(
      filter(
        await Promise.all(
          zip(channels, responseTimes).map(([{ phoneNumber }, responseTime]) => {
            metrics.setGauge(metrics.gauges.CHANNEL_HEALTH, responseTime, [phoneNumber])
            if (responseTime === -1) return _handleFailedHealtcheck(phoneNumber, channels.length)
          }),
        ),
        'isFatal',
      ),
      'channelPhoneNumber',
    )

    const socketIds = await Promise.all(fatalHealtcheckFailures.map(channelRepository.getSocketId))

    const failedChannelsBySocketId = mapValues(
      groupBy(zip(fatalHealtcheckFailures, socketIds), ([, socketId]) => socketId),
      x => map(x, head),
    )

    return Promise.all(
      map(failedChannelsBySocketId, (channelPhoneNumbers, socketId) =>
        _restartAndNotify(parseInt(socketId), channelPhoneNumbers),
      ),
    )

    // return Promise.all(fatalHealtcheckFailures.map(_restartAndNotify))
  } catch (e) {
    logger.error(e)
  }
}

// string -> Promise<{isFatal: boolean}>
const _handleFailedHealtcheck = async (channelPhoneNumber, numHealtchecks) => {
  // Alert maintainers if channel has failed 2 consecutive healthchecks,
  // and return flag signaling fatal failure.
  logger.log(`Healthcheck failure: ${channelPhoneNumber}`)
  if (failedHealthchecks.has(channelPhoneNumber)) {
    logger.log(`Fatal healthcheck failure: ${channelPhoneNumber}`)
    return { isFatal: true, channelPhoneNumber }
  }
  // Otherwise cache the failure for another round of health checks,
  // and return flag signaling non-fatal failure
  failedHealthchecks.add(channelPhoneNumber)
  util
    .wait(2 * numHealtchecks * (healthcheckTimeout + healthcheckSpacing))
    .then(() => failedHealthchecks.delete(channelPhoneNumber))
  return { isFatal: false, channelPhoneNumber }
}

// (number, Array<string>) => Promise<string>
const _restartAndNotify = async (socketId, channelPhoneNumbers) => {
  try {
    logger.log(`--- SYSTEM REQUESTING AUTOMATED RESTART OF SHARD ${socketId}...`)
    await notifier.notifyMaintainers(
      `Restarting shard ${socketId} due to failed healthchecks on ${channelPhoneNumbers}.`,
    )
    await restart(socketId)
    return notifier.notifyMaintainers(`Shard ${socketId} restarted successfully!`)
  } catch (err) {
    const msg = `Failed to restart shard: ${err.message || err}`
    logger.error(msg)
    return notifier.notifyMaintainers(msg)
  }
}

// Array<string> => Promise<Array<string>>
const restartAll = () => Promise.all(times(availableSockets, restart))

// string => Promise<string>
const restart = async socketId => {
  logger.log(`--- RESTARTING SHARD ${socketId}`)
  const channelsOnSocket = await channelRepository.getChannelsOnSocket(socketId)
  if (isEmpty(channelsOnSocket)) return console.log(`--- DID NOT RESTART EMPTY SHARD ${socketId}`)
  /******** STOP *********/
  // unsubscribe from channels on this socket
  await Promise.all(channelsOnSocket.map(ch => signal.unsubscribe(ch.phoneNumber, socketId)))
  // send signald instances listening on this socket a poison pill (docker-compose will restart them)
  await signal.abort(socketId)
  // stop talking on this socket
  await app.stopSocket(socketId)

  /******* START *********/
  // wait for signald to spin up so that connecting to socket (and subscribing) works
  await util.wait(restartDelay)
  // connect to signald on this socket
  await app.restartSocket(socketId)
  // re-subscribe
  await Promise.all(channelsOnSocket.map(ch => signal.subscribe(ch.phoneNumber, socketId)))
  // make sure it worked!
  await signal.isAlive(socketId)
  logger.log(`--- SHARD ${socketId} RESTART SUCCEEDED`)
}

// (Channel, string) => Promise<string>
const respondToHealthcheck = (channel, healthcheckId) =>
  signal.sendMessage(
    sdMessageOf({
      sender: channel.phoneNumber,
      recipient: diagnosticsPhoneNumber,
      message: `${messageTypes.HEALTHCHECK_RESPONSE} ${healthcheckId}`,
    }),
    channel.socketId,
  )

module.exports = {
  respondToHealthcheck,
  restartAll,
  sendHealthchecks,
  failedHealthchecks,
}
