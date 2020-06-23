const twilio = require('twilio')
const { smsUrl } = require('../../registrar/phoneNumber/common')
const {
  api: { authToken },
  twilio: { smsEndpoint, authToken: twilioAuthToken },
} = require('../../config')

const configureAuthenticator = app => app.use(authenticator)

const authenticator = async (ctx, next) =>
  isAuthorized(ctx) ? await next() : respondNotAuthorized(ctx)

const isAuthorized = ctx => {
  switch (ctx.path) {
    case `/healthcheck`:
      return true
    case '/metrics':
      return true
    case `/${smsEndpoint}`:
      return isValidTwilioRequest(ctx)
    default:
      return ctx.request.headers.token === authToken
  }
}

const isValidTwilioRequest = ctx =>
  // validate signature according to scheme given here:
  // https://www.twilio.com/docs/usage/security#validating-requests
  twilio.validateRequest(
    twilioAuthToken,
    ctx.request.header['x-twilio-signature'],
    smsUrl,
    ctx.request.body,
  )

const respondNotAuthorized = ctx => {
  ctx.status = 401
  ctx.body = { error: 'Not Authorized' }
}

module.exports = { configureAuthenticator }
