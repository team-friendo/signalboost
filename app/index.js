const app = {}

app.run = async ({ db, sock, registrar, dispatcher }) => {
  const { logger } = require('./services/util')
  const dbService = db || require('./db')
  const socketService = sock || require('./services/socket')
  const registrarService = registrar || require('./services/registrar')
  const dispatcherService = dispatcher || require('./services/dispatcher')

  logger.log('> Initializing Signalboost...')

  /**  INITIALIZE RESOURCES **/

  logger.log('Getting database connection...')
  app.db = await dbService.run().catch(logger.fatalError)

  logger.log('Connecting to signald socket...')
  app.sock = await socketService.run().catch(logger.fatalError)

  /** START SERVICES **/

  logger.log('Starting registrar...')
  await registrarService.run().catch(logger.fatalError)

  logger.log('Starting dispatcher')
  await dispatcherService.run().catch(logger.fatalError)

  logger.log('> Signalboost running!')
  return app
}

app.stop = async () => {
  const { logger } = require('./services/util')
  logger.log('Shutting down signalboost...')
  await Promise.all([app.db.stop(), app.sock.stop()])
  logger.log('...Signalboost shut down!')
}

module.exports = app
