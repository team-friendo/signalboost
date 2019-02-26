const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const logger = require('koa-logger')
const Router = require('koa-router')
const { configureAuthenticator } = require('./middleware/authenticator')
const phoneNumberRoutes = require('./routes/phoneNumber')
const docker = require('./docker')
const phoneNumberService = require('./phoneNumber')

const run = async (port, db, emitter) => {

  console.log('> listening on port', port)
  await startApiServer(port, db, emitter)

  console.log('> intializing phone numbers...')
  await initializePhoneNumbers(db, emitter)
  console.log('> intialized phone numbers. running...')
}

// TODO: generalize this!
const phoneNumber = '+15129910157'

const initializePhoneNumbers = (db, emitter) =>
  phoneNumberService
    .register({ db, emitter, phoneNumber })
    .then(console.log)
    .then(() => docker.runContainer(phoneNumber))
    .then(() => console.log(`> Channel ${phoneNumber} active!`))
    .catch(console.error)

const startApiServer = async (port, db, emitter) => {
  const app = new Koa()

  configureLogger(app)
  configureBodyParser(app)
  configureAuthenticator(app)
  configureRoutes(app, db, emitter)

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

const configureRoutes = (app, db, emitter) => {
  const router = new Router()

  router.get('/hello', async ctx => {
    ctx.body = { msg: 'hello world' }
  })

  phoneNumberRoutes(router, db, emitter)

  app.use(router.routes())
  app.use(router.allowedMethods())
}

module.exports = { run }
