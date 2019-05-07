const { initDb, getDbConnection } = require('./db')
const { logger, wait } = require('./services/util')
const signal = require('./services/signal')
// TODO: move dispatcher/run, api/run to dispatcher/index, api/index
const dispatcher = require('./services/dispatcher/run')
const api = require('./services/api/run')

const run = async () => {
  logger.log('----- Initializing Signalboost...')

  logger.log('Getting database connection...')
  const db = initDb()
  await getDbConnection(db).catch(logger.fatalError)
  logger.log('Got database connection!')

  logger.log('Connecting to signald socket...')
  const sock = await signal.getSocket().catch(logger.fatalError)
  logger.log('Connected to signald socket!')

  await wait(500)
  await api.run(db, sock)
  await dispatcher.run(db, sock)

  logger.log('----- Signalboost running!')
}

module.exports = { run }
