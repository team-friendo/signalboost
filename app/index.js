const {
  api: { host, port },
} = require('./config')

const app = {
  db: null,
  sock: null,
  api: null,
}

app.run = async ({ db, sock, api, jobs, dispatcher }) => {
  const { logger } = require('./util')
  const dbService = db || require('./db')
  const socketService = sock || require('./socket')
  const apiService = api || require('./api')
  const jobsService = jobs || require('./jobs')
  const dispatcherService = dispatcher || require('./dispatcher')

  logger.log('> Initializing Signalboost...')

  logger.log('Connecting to database...')
  app.db = await dbService.run().catch(logger.fatalError)
  logger.log('...connected to database!')

  logger.log('Connecting to signald socket...')
  app.sock = await socketService.run().catch(logger.fatalError)
  logger.log('...connected to signald socket!')

  logger.log('Starting api server...')
  app.api = await apiService.run().catch(logger.fatalError)
  logger.log(`...api server running at ${host}:${port}!`)

  logger.log('Running startup jobs...')
  await jobsService.run().catch(logger.fatalError)
  logger.log('...ran startup jobs!')

  logger.log('Starting dispatcher')
  await dispatcherService.run().catch(logger.fatalError)
  logger.log('...dispatcher running!')

  logger.log('> Signalboost running!')
  return app
}

app.stop = async () => {
  const { logger } = require('./util')
  logger.log('Shutting down signalboost...')
  await Promise.all([app.db.stop(), app.sock.stop(), app.api.stop()])
  logger.log('...Signalboost shut down!')
}

module.exports = app
