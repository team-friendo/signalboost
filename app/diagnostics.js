const channelRepository = require('./db/repositories/channel')
const app = require('../app')
const util = require('./util')
const signal = require('./signal')
const { messageTypes } = require('./signal/constants')
const metrics = require('./metrics')
const notifier = require('./notifier')
const { times, filter, isEmpty, partition, zip } = require('lodash')
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
  try {
    const [[diagnosticsChannel], channels] = partition(
      await channelRepository.findAll(),
      channel => channel.phoneNumber === diagnosticsPhoneNumber,
    )
    const responseTimes = await util.sequence(
      channels.map(({ phoneNumber }) => () =>
        signal.healthcheck(phoneNumber, diagnosticsChannel.socketId),
      ),
      healthcheckSpacing,
    )
    const fatalHealtcheckFailures = await Promise.all(
      zip(channels, responseTimes).map(([{ phoneNumber }, responseTime]) => {
        metrics.setGauge(metrics.gauges.CHANNEL_HEALTH, responseTime, [phoneNumber])
        if (responseTime === -1) return _handleFailedHealtcheck(phoneNumber, channels.length)
      }),
    )

    return !isEmpty(filter(fatalHealtcheckFailures, 'isFatal'))
      ? _restartAndNotify()
      : Promise.resolve('')
  } catch (e) {
    logger.error(e)
  }
}

// string -> Promise<{isFatal: boolean}>
const _handleFailedHealtcheck = async (channelPhoneNumber, numHealtchecks) => {
  // Alert maintainers if channel has failed 2 consecutive healthchecks,
  // and return flag signaling fatal failure. (Ignore "boy who cried wolf" numbers, for now.)
  if (channelPhoneNumber === process.env.SIGNALBOOST_HEALTHCHECK_BLACKLIST)
    return { isFatal: false }
  if (failedHealthchecks.has(channelPhoneNumber)) {
    await notifier.notifyMaintainers(
      `Channel ${channelPhoneNumber} failed to respond to 2 consecutive healthchecks.`,
    )
    return { isFatal: true }
  }
  // Otherwise cache the failure for another round of health checks,
  // and return flag signaling non-fatal failure
  failedHealthchecks.add(channelPhoneNumber)
  util
    .wait(2 * numHealtchecks * (healthcheckTimeout + healthcheckSpacing))
    .then(() => failedHealthchecks.delete(channelPhoneNumber))
  return { isFatal: false }
}

// () => Promise<string>
const _restartAndNotify = async () => {
  try {
    logger.log(`--- RESTART INITIATED by system...`)
    await notifier.notifyMaintainers('Restarting Signalboost due to failed healthchecks...')
    await restart()
    logger.log(`--- RESTART SUCCEEDED.`)
    return notifier.notifyMaintainers('Signalboost restarted successfully!')
  } catch (err) {
    return notifier.notifyMaintainers(`Failed to restart Signalboost: ${err.message || err}`)
  }
}

// () => Promise<string>
const restart = async () => {
  // send all signald instances a poison pill (causing them to shutdown and restart)
  await Promise.all(times(availableSockets, socketId => signal.abort(socketId)))
  // restart all signalboost application components (without shutting down signalboost process)
  await app.stop()
  await util.wait(restartDelay) // wait for signald to restart (so `subscribe` calls in `app.run()` work)
  await app.run({})
  // ensure that all signald instances are responsive before proceeding
  await util.wait(restartDelay)
  await Promise.all(times(availableSockets, socketId => signal.isAlive(socketId)))
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
  restart,
  sendHealthchecks,
  failedHealthchecks,
}
