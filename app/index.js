const dbService = require('./db')
const socketService = require('./services/socket')
const { logger } = require('./services/util')

const app = {
  db: null,
  sock: null,
}

app.initialize = async () => {
  logger.log('> Initializing Signalboost...')

  logger.log('Getting database connection...')
  app.db = await dbService.initDb().catch(logger.fatalError)
  logger.log('Got database connection!')

  logger.log('Connecting to signald socket...')
  app.sock = await socketService.getSocket().catch(logger.fatalError)
  logger.log('Connected to signald socket!')
}

module.exports = app
