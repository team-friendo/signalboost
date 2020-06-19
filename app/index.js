const app = {
  db: null,
  sock: null,
}

app.run = async () => {
  /**  IMPORT MODULES **/
  const dbService = require('./db')
  const socketService = require('./services/socket')
  const registrar = require('./services/registrar')
  const dispatcher = require('./services/dispatcher')
  const { logger } = require('./services/util')

  logger.log('> Initializing Signalboost...')

  /**  INITIALIZE RESOURCES **/

  logger.log('Getting database connection...')
  app.db = await dbService.initDb().catch(logger.fatalError)

  logger.log('Connecting to signald socket...')
  app.sock = await socketService.getSocket().catch(logger.fatalError)

  /** START SERVICES **/

  logger.log('Starting registrar...')
  await registrar.run(app.db, app.sock)

  logger.log('Starting dispatcher')
  await dispatcher.run()

  logger.log('> Signalboost running!')
}

module.exports = app
