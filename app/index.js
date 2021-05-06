const app = {
  db: null,
  sockets: null,
  api: null,
  metrics: null,
  jobs: null,
}

app.run = async ({ db, sockets, api, metrics, jobs, signal }) => {
  // we do our imports here b/c if we don't, all the modules we store on `app` are null
  // when we try to invoke them from modules that depend on `app`.
  // (gross, but import-time restrictions are not our forte so we'll deal for now?) - /a/

  const { logger } = require('./util')
  logger.log('> Initializing Signalboost...')

  logger.log('Connecting to database...')
  const dbService = db || require('./db')
  app.db = await dbService.run().catch(logger.fatalError)
  logger.log('...connected to database!')

  logger.log('Connecting to signald socket...')
  const socketService = sockets || require('./sockets')
  app.sockets = await socketService.run().catch(logger.fatalError)
  logger.log('...connected to signald socket!')

  logger.log('Creating metrics registry...')
  const metricsService = metrics || require('./metrics')
  app.metrics = metricsService.run()
  logger.log(`...created metrics registry!`)

  logger.log('Starting api server...')
  const apiService = api || require('./api')
  app.api = await apiService.run().catch(logger.fatalError)
  const { host, port } = app.api
  logger.log(`...api server running at ${host}:${port}!`)

  logger.log('Starting signal service...')
  const signalService = signal || require('./signal')
  // TODO(aguestuser|2020-04-29): store signal service as a field on app and call it that way from other modules?
  await signalService.run().catch(logger.fatalError)
  logger.log('...signal service running!')

  logger.log('Running startup jobs...')
  const jobsService = jobs || require('./jobs')
  app.jobs = await jobsService.run().catch(logger.fatalError)
  logger.log('...ran startup jobs!')

  logger.log('> Signalboost running!')
  return app
}

app.stop = async () => {
  const { logger } = require('./util')
  logger.log('Shutting down signalboost...')
  await Promise.all([
    () => app.sockets.stop(),
    () => app.db.stop(),
    () => app.api.stop(),
    () => app.jobs.stop(),
  ])
  logger.log('...Signalboost shut down!')
}

module.exports = app
