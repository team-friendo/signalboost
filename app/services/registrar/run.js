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
  //  - it would be nice to have something more elegant, like...
  //    - trust changes safety numbers ASAP when they change
  //      (requires upstream fix: https://gitlab.com/thefinn93/signald/issues/4)
  //    - only use this job for admins, b/c we can detect subscriber safety number changes via message send failure
  //      (see: https://0xacab.org/team-friendo/signalboost/issues/86)
  //    - allow admins to trust each other, making it feasible to not run this job if they are vigilant
  //      (see: https://0xacab.org/team-friendo/signalboost/issues/87)
  logger.log('----- Scheduling safety number checks...')
  util.wait(signaldStartupTime).then(() =>
    util.repeatEvery(() => {
      logger.log('Running safety number check...')
      return safetyNumberRegistrar
        .trustAll(db, sock)
        .then(res => logger.log(`Safety number check results: ${JSON.stringify(res)}`))
        .catch(logger.error)
    }, safetyNumberCheckInterval),
  )
  logger.log(`----- Scheduled safety number checks.`)

  logger.log('--- Registrar running!')
}

module.exports = { run }
