const { initDb, getDbConnection } = require('./db')
const { logger, wait } = require('./services/util')
const socket = require('./services/socket')
// TODO: move dispatcher/run, registrar/run to dispatcher/index, registrar/index
const dispatcher = require('./services/dispatcher/run')
const registrar = require('./services/registrar/run')

const run = async () => {
  logger.log('> Initializing Signalboost...')

  logger.log('Getting database connection...')
  const db = initDb()
  await getDbConnection(db).catch(logger.fatalError)
  logger.log('Got database connection!')

  logger.log('Connecting to signald socket...')
  const sock = await socket.getSocket().catch(logger.fatalError)
  logger.log('Connected to signald socket!')

  await wait(500)
  await registrar.run(db, sock)
  await dispatcher.run(db, sock)

  logger.log('> Signalboost running!')
}

module.exports = { run }
