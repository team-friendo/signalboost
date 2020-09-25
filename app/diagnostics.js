const channelRepository = require('./db/repositories/channel')
const util = require('./util')
const signal = require('./signal')
const { messageTypes } = require('./signal/constants')
const metrics = require('./metrics')
const notifier = require('./notifier')
const { zip } = require('lodash')
const { sdMessageOf } = require('./signal/constants')
const {
  signal: { diagnosticsPhoneNumber, healthcheckSpacing, healthcheckTimeout },
} = require('./config')

const logger = util.loggerOf('diagnostics')

// Set<string>
const failedHealthchecks = new Set()

// () => Promise<void>
const sendHealthchecks = async () => {
  try {
    const channelPhoneNumbers = (await channelRepository.findAll())
      .map(channel => channel.phoneNumber)
      .filter(phoneNumber => phoneNumber !== diagnosticsPhoneNumber)
    const responseTimes = await util.sequence(
      channelPhoneNumbers.map(phoneNumber => () => signal.healthcheck(phoneNumber)),
      healthcheckSpacing,
    )
    await Promise.all(
      zip(channelPhoneNumbers, responseTimes).map(([channelPhoneNumber, responseTime]) => {
        metrics.setGauge(metrics.gauges.CHANNEL_HEALTH, responseTime, [channelPhoneNumber])
        if (responseTime === -1)
          return _handleFailedHealtcheck(channelPhoneNumber, channelPhoneNumbers.length)
      }),
    )
  } catch (e) {
    logger.error(e)
  }
}

// string -> Promise<void>
const _handleFailedHealtcheck = async (channelPhoneNumber, numHealtchecks) => {
  // alert maintainers if channel has failed 2 consecutive healthchecks
  if (failedHealthchecks.has(channelPhoneNumber))
    await notifier.notifyMaintainers(
      `Channel ${channelPhoneNumber} failed to respond to healthcheck`,
    )
  // otherwise cache the failure for another round of health checks so we can alert if it fails again
  failedHealthchecks.add(channelPhoneNumber)
  util
    .wait(2 * numHealtchecks * (healthcheckTimeout + healthcheckSpacing))
    .then(() => failedHealthchecks.delete(channelPhoneNumber))
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
  sendHealthchecks,
  failedHealthchecks,
}
