const phoneNumberService = require('../phoneNumber/index')
const activate = require('./activate')
const channelRepository = require('../../db/repositories/channel')
const logger = require('../api/logger')
const { find } = require('lodash')
const { prettyPrint } = require('../util')

// TODO:
// - this should be called from dispatcher/run  (in fact we should just move this code there)
const initialize = async ({ db, emitter }) => {
  logger.log('registering phone numbers...')
  const registrationResults = await phoneNumberService.registerAllUnregistered({ db, emitter })
  logResults('registering phone numbers', registrationResults)

  const channels = await channelRepository.findAll(db)

  logger.log('activating channels....')
  const activationResults = await activate.activateMany(db, channels)
  logResults('activating channels', activationResults)

  return { registered: registrationResults.length, activated: activationResults.length }
}

const logResults = (prefix, results) =>
  find(results, r => r.error)
    ? logger.log(`${prefix} failed: \n ${prettyPrint(results)}`)
    : logger.log(`${prefix} succeeded for: ${results.map(r => r.phoneNumber)}`)

module.exports = { initialize }
