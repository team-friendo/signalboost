const Router = require('koa-router')
const Koa = require('koa')
const bodyParser = require('koa-bodyparser')

const run = async (db, port) => {
  const app = new Koa()

  configureBodyParser(app)
  configureRoutes(app)

  const server = await app.listen(port).on('error', console.error)
  return Promise.resolve({ app, server })
}

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

  router.post('/hello', async ctx => {
    ctx.body = { status: 200, msg: 'hello world' }
  })

  app.use(router.routes())
}

module.exports = { run }
