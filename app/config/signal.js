const defaults = {
  verificationTimeout: 30000, // 30 seconds
  keystorePath: '/var/lib/signald/data', // given by docker-compose file(s)
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
  registrationBatchSize: 5,
  identityRequestTimeout: 1000, // 1 sec
  intervalBetweenRegistrationBatches: 120000, // 2 minutes
  intervalBetweenRegistrations: 2000, // 2 seconds
  resendDelay: 3000, // 3 seconds
  signaldStartupTime: 1000 * 60 * 5, // 5 minutes
  welcomeDelay: 3000, // 3 sec
  signupChannel: process.env.SIGNUP_CHANNEL,
}

const test = {
  ...defaults,
  verificationTimeout: 30, // 30 millis
  connectionInterval: 10, // 10 milli
  maxConnectionAttempts: 10,
  identityRequestTimeout: 100, // 100 millis
  intervalBetweenRegistrationBatches: 30, // 100 millis
  intervalBetweenRegistrations: 5, // 10 millis,
  resendDelay: 40, // 40 millis
  signaldStartupTime: 1, // 1 milli
  welcomeDelay: 0.0001, // .0001 millis
  signupChannel: '+15555555555',
}

const development = {
  ...defaults,
  signupChannel: '+13343264237',
}

module.exports = {
  development,
  test,
  production: defaults,
}
