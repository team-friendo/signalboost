const {
  api: { authToken },
} = require('../../../config')

const configureAuthenticator = app =>
  app.use(async function authenticator(ctx, next) {
    const { token } = ctx.request.headers
    token === authToken ? next() : respondNotAuthorized(ctx)
  })

const respondNotAuthorized = ctx => {
  ctx.status = 401
  ctx.body = { error: 'Not Authorized' }
}

module.exports = { configureAuthenticator }
