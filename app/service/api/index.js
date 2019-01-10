const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const logger = require('koa-logger')
const { EventEmitter } = require('events')
const Router = require('koa-router')
const { configureAuthenticator } = require('./middleware/authenticator')
const phoneNumberRoutes = require('./routes/phoneNumber')

const run = async (db, port) => {
  const app = new Koa()

  configureLogger(app)
  configureBodyParser(app)
  configureAuthenticator(app)
  configureRoutes(app, db)

  const server = await app.listen(port).on('error', console.error)
  return Promise.resolve({ app, server })
}

const configureLogger = app => process.env.NODE_ENV !== 'test' && app.use(logger())

const configureBodyParser = app => {
  app.use(
    bodyParser({
      extendTypes: {
        json: ['application/x-javascript'],
      },
    }),
  )
}

const configureRoutes = (app, db) => {
  const router = new Router()
  const emitter = new EventEmitter()

  router.get('/hello', async ctx => {
    ctx.body = { msg: 'hello world' }
  })

  phoneNumberRoutes(router, db, emitter)

  app.use(router.routes())
}

module.exports = { run }
