const logger = require('./logger')
const phoneNumberRegistrar = require('./phoneNumber')
const inviteRepository = require('../../db/repositories/invite')
const smsSenderRepository = require('../../db/repositories/smsSender')
const hotlineMessageRepository = require('../../db/repositories/hotlineMessage')
const api = require('./api')
const {
  registrar: { host, port },
} = require('../../config')

const run = async (db, sock) => {
  logger.log('--- Initializing Registrar...')

  logger.log(`----- Staring api server...`)
  await api.startServer(port, db, sock).catch(logger.error)
  logger.log(`----- Api server listening on ${host}:${port}`)

  logger.log('----- Registering phone numbers...')
  const regs = await phoneNumberRegistrar.registerAllUnregistered({ db, sock }).catch(logger.error)
  logger.log(`----- Registered ${regs.length} phone numbers.`)

  logger.log('----- Deleting expired sms sender records...')
  // here we rely on fact of nightly backups to ensure this task runs once every 24 hr.
  const sendersDeleted = await smsSenderRepository.deleteExpired(db)
  logger.log(`----- Deleted ${sendersDeleted} expired sms sender records.`)

  logger.log('----- Deleting expired hotline message records...')
  // here we rely on fact of nightly backups to ensure this task runs once every 24 hr.
  const messageIdsDeleted = await hotlineMessageRepository.deleteExpired(db)
  logger.log(`----- Deleted ${messageIdsDeleted} expired sms sender records.`)

  logger.log('----- Launching data cleaning jobs...')
  inviteRepository.launchInviteDeletionJob(db)
  logger.log('----- Launched data cleaning jobs.')

  logger.log('--- Registrar running!')
}

module.exports = { run }
