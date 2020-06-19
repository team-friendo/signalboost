const app = {
  db: null,
  sock: null,
}

app.run = async ({ db, sock, registrar, dispatcher }) => {
  const { logger } = require('./services/util')
  const dbService = db || require('./db')
  const socketService = sock || require('./services/socket')
  const registrarService = registrar || require('./services/registrar')
  const dispatcherService = dispatcher || require('./services/dispatcher')

  logger.log('> Initializing Signalboost...')

  /**  INITIALIZE RESOURCES **/

  logger.log('Getting database connection...')
  app.db = await dbService.initDb().catch(logger.fatalError)

  logger.log('Connecting to signald socket...')
  app.sock = await socketService.getSocket().catch(logger.fatalError)

  /** START SERVICES **/

  logger.log('Starting registrar...')
  await registrarService.run(app.db, app.sock)

  logger.log('Starting dispatcher')
  await dispatcherService.run()

  logger.log('> Signalboost running!')
}

module.exports = app
