const defaults = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  smsEndpoint: 'twilioSms',
  smsQuotaAmount: 3,
  smsQuotaDurationInMillis: 1000 * 60 * 60 * 24 * 31, // 1 month
}

module.exports = {
  development: defaults,
  test: defaults,
  production: defaults,
}
