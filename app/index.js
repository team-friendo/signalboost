const {
  api: { host, port },
} = require('./config')

const app = {
  db: null,
  socketPools: null,
  api: null,
  metrics: null,
  jobs: null,
}

app.run = async ({ db, socketPools, api, metrics, jobs, signal }) => {
  // we do our imports here b/c if we don't, all the modules we store on `app` are null
  // when we try to invoke them from modules that depend on `app`.
  // (gross, but import-time restrictions are not our forte so we'll deal for now?) - /a/
  const { logger } = require('./util')
  const dbService = db || require('./db')
  const socketService = socketPools || require('./socket')
  const apiService = api || require('./api')
  const metricsService = metrics || require('./metrics')
  const jobsService = jobs || require('./jobs')
  const signalService = signal || require('./signal')

  logger.log('> Initializing Signalboost...')

  logger.log('Connecting to database...')
  app.db = await dbService.run().catch(logger.fatalError)
  logger.log('...connected to database!')

  logger.log('Connecting to signald socket...')
  app.socketPools = await socketService.run().catch(logger.fatalError)
  logger.log('...connected to signald socket!')

  logger.log('Creating metrics registry...')
  app.metrics = metricsService.run()
  logger.log(`...created metrics registry!`)

  logger.log('Starting api server...')
  app.api = await apiService.run().catch(logger.fatalError)
  logger.log(`...api server running at ${host}:${port}!`)

  logger.log('Running startup jobs...')
  app.jobs = await jobsService.run().catch(logger.fatalError)
  logger.log('...ran startup jobs!')

  logger.log('Starting signal service...')
  await signalService.run().catch(logger.fatalError)
  logger.log('...signal service running!')

  logger.log('> Signalboost running!')
  return app
}

app.stop = async () => {
  const { logger } = require('./util')
  logger.log('Shutting down signalboost...')
  await Promise.all([
    () => app.socketPools.stop(),
    () => app.db.stop(),
    () => app.api.stop(),
    () => app.jobs.stop(),
  ])
  logger.log('...Signalboost shut down!')
}

module.exports = app
