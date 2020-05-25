const defaults = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  smsEndpoint: 'twilioSms',
  monthlySmsQuota: 3,
}

module.exports = {
  development: defaults,
  test: defaults,
  production: defaults,
}
