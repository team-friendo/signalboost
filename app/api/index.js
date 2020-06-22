const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const requestLogger = require('koa-logger')
const Router = require('koa-router')
const { configureAuthenticator } = require('./middleware/authenticator')
const routesOf = require('./routes')
const logger = require('../registrar/logger')
const { api: { port } } = require('../config')

const run = async () => {
  const app = new Koa()

  configureLogger(app)
  configureBodyParser(app)
  configureAuthenticator(app)
  configureRoutes(app)

  const server = await app.listen(port).on('error', logger.error)
  const stop = () => server.close()
  return Promise.resolve({ app, server, stop })
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

const configureRoutes = app => {
  const router = new Router()
  routesOf(router)
  app.use(router.routes())
  app.use(router.allowedMethods())
}

module.exports = { run }
