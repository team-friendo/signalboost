const {
  registrar: { authToken },
  twilio: { smsEndpoint },
} = require('../../../config')

const configureAuthenticator = app => app.use(authenticator)

const authenticator = async (ctx, next) =>
  isAuthorized(ctx) ? await next() : respondNotAuthorized(ctx)

// TODO(aguestuser): only allow twilio to make requests to this url...
// see: https://0xacab.org/team-friendo/signalboost/issues/202
const isAuthorized = ctx =>
  ctx.path === `/${smsEndpoint}` || ctx.request.headers.token === authToken

const respondNotAuthorized = ctx => {
  ctx.status = 401
  ctx.body = { error: 'Not Authorized' }
}

module.exports = { configureAuthenticator }
