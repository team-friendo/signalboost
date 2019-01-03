const defaults = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  smsUrl: 'https://foobar.com',
}

module.exports = {
  development: defaults,
  test: defaults,
  production: defaults,
}