const channelRepository = require('./db/repositories/channel')
const util = require('./util')
const signal = require('./signal')
const { messageTypes } = require('./signal/constants')
const metrics = require('./metrics')
const { zip } = require('lodash')
const { sdMessageOf } = require('./signal/constants')
const {
  signal: { diagnosticsPhoneNumber, healtcheckInterval, healthcheckSpacing, signaldStartupTime },
} = require('./config')

const logger = util.loggerOf('diagnostics')

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
    zip(channelPhoneNumbers, responseTimes).forEach(([channelPhoneNumber, responseTime]) => {
      metrics.setGauge(metrics.gauges.CHANNEL_HEALTH, responseTime, [channelPhoneNumber])
      if (responseTime === -1) _sendTimeoutAlerts(channelPhoneNumber)
    })
  } catch (e) {
    logger.error(e)
  }
}

const _sendTimeoutAlerts = async channelPhoneNumber => {
  const diagnosticChannel = await channelRepository.findDeep(diagnosticsPhoneNumber)
  return signal.broadcastMessage(
    channelRepository.getAdminPhoneNumbers(diagnosticChannel),
    sdMessageOf(
      { phoneNumber: diagnosticsPhoneNumber },
      `Channel ${channelPhoneNumber} failed to respond to healthcheck`,
    ),
  )
}

// (string, string) => Promise<string>
const respondToHealthcheck = (channelPhoneNumber, healthcheckId) =>
  signal.sendMessage(
    diagnosticsPhoneNumber,
    sdMessageOf(
      { phoneNumber: channelPhoneNumber },
      `${messageTypes.HEALTHCHECK_RESPONSE} ${healthcheckId}`,
    ),
  )

// () => Promise<void>
const launchHealthcheckJob = async () => {
  await util.wait(signaldStartupTime)
  return diagnosticsPhoneNumber && util.repeatEvery(sendHealthchecks, healtcheckInterval)
}

module.exports = {
  respondToHealthcheck,
  sendHealthchecks,
  launchHealthcheckJob,
}
