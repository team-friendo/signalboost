const phoneNumberService = require('../phoneNumber')
const activate = require('./activate')
const channelRepository = require('../../../db/repositories/channel')
const logger = require('../logger')
const { prettyPrint } = require('../../util')

const initialize = async ({ db, emitter }) => {
  const phStatuses = await phoneNumberService.registerAll({ db, emitter, filter: {} })
  logger.log(`registered phone numbers: ${prettyPrint(phStatuses)}`)

  const channels = await channelRepository.findAll(db)
  logger.log(`activating channels: ${channels.map(ch => ch.phoneNumber)}`)

  // TODO: inspect for errors here?
  const activeChannels = await activate.activateMany(db, channels)
  logger.log(`activated channels: ${activeChannels.map(ch => ch.phoneNumber)}`)

  return { registered: phStatuses.length, activated: activeChannels.length }
}

module.exports = { initialize }
