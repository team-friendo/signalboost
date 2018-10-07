const Router = require('koa-router')
const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const relay = require('./service/relay')
const port = 3000

const run = async () => {
  const app = new Koa()
  
  configureBodyParser(app)
  configureRoutes(app)

  const server = await app.listen(port).on('error', console.error)
  console.log(`Signal-Relay service listening on port ${port}`)

  return Promise.resolve({ app, server })
}

const configureBodyParser = (app) => {
  app.use(bodyParser({
    extendTypes: {
      json: ['application/x-javascript']
    }
  }))
}

const configureRoutes = (app) => {
  const router = new Router()

  router.post('/relay', async ctx => {
    const { message, recipients } = ctx.request.body
    const log = await relay(message, recipients)

    console.log(log)
    ctx.body = { status: 200, msg: log }
  })

  app.use(router.routes())
}
  
module.exports = run

