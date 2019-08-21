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

  // NOTE(aguestuser|2019-08-21):
  // - this causes signald to stop working in unexepected ways (and stop relaying messages)...
  // - commenting out until we can deterimine why...

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
