const { loggerOf } = require('../util')
const { containerNameOf } = require('../orchestrator/docker')
const { channelPhoneNumber } = require('../../config')

module.exports = loggerOf(containerNameOf('signalboost_dispatcher', channelPhoneNumber))
