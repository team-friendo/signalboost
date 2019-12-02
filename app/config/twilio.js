const defaults = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  smsEndpoint: 'twilioSms',
}

module.exports = {
  development: defaults,
  test: defaults,
  production: defaults,
}
