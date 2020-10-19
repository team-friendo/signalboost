const channelRepository = require('./db/repositories/channel')
const app = require('../app')
const util = require('./util')
const signal = require('./signal')
const { messageTypes } = require('./signal/constants')
const metrics = require('./metrics')
const notifier = require('./notifier')
const { filter, isEmpty, zip } = require('lodash')
const { sdMessageOf } = require('./signal/constants')
const {
  signal: { diagnosticsPhoneNumber, healthcheckSpacing, healthcheckTimeout, restartDelay },
} = require('./config')

const logger = util.loggerOf('diagnostics')

// Set<string>
const failedHealthchecks = new Set()

// () => Promise<string>
const sendHealthchecks = async () => {
  try {
    const channelPhoneNumbers = (await channelRepository.findAll())
      .map(channel => channel.phoneNumber)
      .filter(phoneNumber => phoneNumber !== diagnosticsPhoneNumber)

    const responseTimes = await util.sequence(
      channelPhoneNumbers.map(phoneNumber => () => signal.healthcheck(phoneNumber)),
      healthcheckSpacing,
    )

    const fatalHealtcheckFailures = await Promise.all(
      zip(channelPhoneNumbers, responseTimes).map(([channelPhoneNumber, responseTime]) => {
        metrics.setGauge(metrics.gauges.CHANNEL_HEALTH, responseTime, [channelPhoneNumber])
        if (responseTime === -1)
          return _handleFailedHealtcheck(channelPhoneNumber, channelPhoneNumbers.length)
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
  // and return flag signaling fatal failure
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
  await signal.abort() // rely on docker-compose semantics to restart signald
  await app.stop()
  await util.wait(restartDelay) // wait for signald to restart (so `subscribe` calls in `app.run()` work)
  await app.run({})
  await signal.isAlive() // ensure signald is actually running
}

// (string, string) => Promise<string>
const respondToHealthcheck = (channelPhoneNumber, healthcheckId) =>
  signal.sendMessage(
    sdMessageOf({
      sender: channelPhoneNumber,
      recipient: diagnosticsPhoneNumber,
      message: `${messageTypes.HEALTHCHECK_RESPONSE} ${healthcheckId}`,
    }),
  )

module.exports = {
  respondToHealthcheck,
  restart,
  sendHealthchecks,
  failedHealthchecks,
}
