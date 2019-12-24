const logger = require('./logger')
const phoneNumberRegistrar = require('./phoneNumber')
const inviteRepository = require('../../db/repositories/invite')
const api = require('./api')
const {
  registrar: { port },
} = require('../../config')

const run = async (db, sock) => {
  logger.log('--- Initializing Registrar...')

  logger.log(`----- Staring api server...`)
  await api.startServer(port, db, sock).catch(logger.error)
  logger.log(`----- Api server listening on port ${port}`)

  logger.log('----- Registering phone numbers...')
  const regs = await phoneNumberRegistrar.registerAllUnregistered({ db, sock }).catch(logger.error)
  logger.log(`----- Registered ${regs.length} phone numbers.`)

  logger.log('----- Launching data cleaning jobs...')
  inviteRepository.launchInviteDeletionJob(db)
  logger.log('----- Launched data cleaning jobs.')

  logger.log('--- Registrar running!')
}

module.exports = { run }
