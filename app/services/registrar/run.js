const logger = require('./logger')
const phoneNumberRegistrar = require('./phoneNumber')
const safetyNumberRegistrar = require('./safetyNumbers')
const api = require('./api')
const util = require('../util')
const {
  registrar: { port },
  signal: { safetyNumberCheckInterval, signaldStartupTime },
} = require('../../config')

const run = async (db, sock) => {
  logger.log('--- Initializing Registrar...')

  logger.log(`----- Staring api server...`)
  await api.startServer(port, db, sock).catch(logger.error)
  logger.log(`----- Api server listening on port ${port}`)

  logger.log('----- Registering phone numbers...')
  const regs = await phoneNumberRegistrar.registerAllUnregistered({ db, sock }).catch(logger.error)
  logger.log(`----- Registered ${regs.length} phone numbers.`)

  // TODO(aguestuer|2019-09-3):
  //  - this trusts every single user's safety number every day to avoid unverified safety numbers
  //  - it fails for 160 out of 168 users on prod
  //  - after repeated calls it causes signald to fall down (presumably b/c of repeated NPE's)
  //  - comment it for now, and see if we can find a clever fix
  //  - one hypothesis: perhaps batching safety number checks to batches of 8 might help?
  //  - for more details see: https://0xacab.org/team-friendo/signalboost/merge_requests/73
  //
  // logger.log('----- Scheduling safety number checks...')
  // util.wait(signaldStartupTime).then(() =>
  //   util.repeatEvery(() => {
  //     logger.log('Running safety number check...')
  //     return safetyNumberRegistrar
  //       .trustAll(db, sock)
  //       .then(res => logger.log(`Safety number check results: ${JSON.stringify(res)}`))
  //       .catch(logger.error)
  //   }, safetyNumberCheckInterval),
  // )
  // logger.log(`----- Scheduled safety number checks.`)

  logger.log('--- Registrar running!')
}

module.exports = { run }
