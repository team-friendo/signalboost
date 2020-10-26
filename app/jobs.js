const logger = require('./registrar/logger')
const phoneNumberRegistrar = require('./registrar/phoneNumber')
const inviteRepository = require('./db/repositories/invite')
const smsSenderRepository = require('./db/repositories/smsSender')
const hotlineMessageRepository = require('./db/repositories/hotlineMessage')
const diagnostics = require('./diagnostics')
const util = require('./util')
const sharding = require('./socket/sharding')
const { values } = require('lodash')
const {
  job: { healthcheckInterval, inviteDeletionInterval, recycleInterval, signaldStartupTime },
  signal: { diagnosticsPhoneNumber },
} = require('./config')

const cancelations = {
  deleteInvitesJob: null,
  recycleJob: null,
  healtcheckJob: null,
}

const run = async () => {
  logger.log('--- Running startup jobs...')

  /******************
   * ONE-OFF JOBS
   *****************/

  logger.log('----- Assigning channels to socket pool shards...')
  // TODO: `sharding` should probably be `sockets`
  await sharding.assignChannelsToSockets()
  logger.log('----- Assigned channels to socket pool shards!')

  if (process.env.REREGISTER_ON_STARTUP === '1') {
    logger.log('----- Registering phone numbers...')
    const regs = await phoneNumberRegistrar.registerAllUnregistered().catch(logger.error)
    logger.log(`----- Registered ${regs.length} phone numbers.`)
  }

  logger.log('----- Deleting expired sms sender records...')
  // rely on fact of nightly backups to ensure this task runs at least every 24 hr.
  const sendersDeleted = await smsSenderRepository.deleteExpired()
  logger.log(`----- Deleted ${sendersDeleted} expired sms sender records.`)

  logger.log('----- Deleting expired hotline message records...')
  // rely on fact of nightly backups to ensure this task runs at least every 24 hr.
  const messageIdsDeleted = await hotlineMessageRepository.deleteExpired()
  logger.log(`----- Deleted ${messageIdsDeleted} expired hotline records.`)

  /******************
   * REPEATING JOBS
   *****************/

  logger.log('----- Launching invite scrubbing job...')
  cancelations.deleteInvitesJob = util.repeatUntilCancelled(
    () => inviteRepository.deleteExpired().catch(logger.error),
    inviteDeletionInterval,
  )
  logger.log('----- Launched invite scrubbing job.')

  logger.log('---- Launching recycle request processing job...')
  cancelations.recycleJob = util.repeatUntilCancelled(
    () => phoneNumberRegistrar.processRecycleRequests().catch(logger.error),
    recycleInterval,
  )
  logger.log('---- Launched recycle request job...')

  logger.log('---- Launching healthcheck job...')
  const launchHealthchecks = async () => {
    await util.wait(signaldStartupTime)
    cancelations.healtcheckJob = util.repeatUntilCancelled(() => {
      diagnostics.sendHealthchecks().catch(logger.error)
    }, healthcheckInterval)
  }
  if (diagnosticsPhoneNumber) launchHealthchecks().catch(launchHealthchecks)
  logger.log('---- Launched healthcheck job...')

  logger.log('--- Startup jobs complete!')
  logger.log('--- Registrar running!')

  return { stop }
}

const stop = () => values(cancelations).forEach(fn => fn())

module.exports = { run, stop }
