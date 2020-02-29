const twilio = require('twilio')
const { smsUrl } = require('../../registrar/phoneNumber/common')
const {
  registrar: { authToken },
  twilio: { smsEndpoint, authToken: twilioAuthToken },
} = require('../../../config')

const configureAuthenticator = app => app.use(authenticator)

const authenticator = async (ctx, next) =>
  isAuthorized(ctx) ? await next() : respondNotAuthorized(ctx)

const isAuthorized = ctx =>
  ctx.path === `/${smsEndpoint}`
    ? isValidTwilioRequest(ctx)
    : ctx.request.headers.token === authToken

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
