const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const requestLogger = require('koa-logger')
const Router = require('koa-router')
const { configureAuthenticator } = require('./middleware/authenticator')
const routesOf = require('./routes')
const channelService = require('./channel')
const logger = require('./logger')
const { getConnection } = require('../../db')
const {
  orchestrator: { port },
} = require('../../config')

const run = async (db, emitter) => {
  logger.log('getting database connection...')
  await getConnection(db)
    .then(logger.log)
    .catch(logger.error)

  logger.log(`staring api server...`)
  await startApiServer(port, db, emitter)
  logger.log(`api server listening on port ${port}`)

  logger.log('intializing channels...')
  await initializeChannels(db, emitter)

  logger.log('RUNNING! :)')
}

const startApiServer = async (port, db, emitter) => {
  const app = new Koa()

  configureLogger(app)
  configureBodyParser(app)
  configureAuthenticator(app)
  configureRoutes(app, db, emitter)

  const server = await app.listen(port).on('error', logger.error)
  return Promise.resolve({ app, server })
}

const configureLogger = app => process.env.NODE_ENV !== 'test' && app.use(requestLogger())

const configureBodyParser = app => {
  app.use(
    bodyParser({
      extendTypes: {
        json: ['application/x-javascript'],
      },
    }),
  )
}

const configureRoutes = (app, db, emitter) => {
  const router = new Router()

  router.get('/hello', async ctx => {
    ctx.body = { msg: 'hello world' }
  })

  routesOf(router, db, emitter)

  app.use(router.routes())
  app.use(router.allowedMethods())
}

const initializeChannels = (db, emitter) =>
  channelService
    .initialize({ db, emitter })
    .then(({ registered, activated }) =>
      logger.log(`registered ${registered} numbers, activated ${activated} channels`),
    )
    .catch(console.error)

module.exports = { run, startApiServer }
