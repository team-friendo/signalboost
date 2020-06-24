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
    case `/${smsEndpoint}`:
      return isValidTwilioRequest(ctx)
    default:
      return isValidToken(ctx.request.headers, authToken)
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

const isValidToken = (headers, authToken) => {
  if (headers.token) {
    return headers.token === authToken
  } else if (headers.authorization) {
    return headers.authorization.split(' ')[1] === authToken
  } else {
    return false
  }
}

const respondNotAuthorized = ctx => {
  ctx.status = 401
  ctx.body = { error: 'Not Authorized' }
}

module.exports = { configureAuthenticator }
