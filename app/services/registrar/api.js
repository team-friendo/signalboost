const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const requestLogger = require('koa-logger')
const Router = require('koa-router')
const { configureAuthenticator } = require('./middleware/authenticator')
const routesOf = require('./routes')
const logger = require('./logger')

const startServer = async (port, db, sock) => {
  const app = new Koa()

  configureLogger(app)
  configureBodyParser(app)
  configureAuthenticator(app)
  configureRoutes(app, db, sock)

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

const configureRoutes = (app, db, sock) => {
  const router = new Router()
  routesOf(router, db, sock)
  app.use(router.routes())
  app.use(router.allowedMethods())
}

module.exports = { startServer }
