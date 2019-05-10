const defaults = {
  verificationTimeout: 30000, // 30 seconds
  keystorePath: '/root/.config/signal/data', // given by docker-compose file(s)
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
  registrationBatchSize: 5,
  intervalBetweenRegistrationBatches: 120000, // 2 minutes
  intervalBetweenRegistrations: 2000, // 2 seconds
}

const test = {
  ...defaults,
  verificationTimeout: 30, // 30 millis
  connectionInterval: 10, // 10 milli
  maxConnectionAttempts: 10,
  intervalBetweenRegistrationBatches: 20, // 20 millis
  intervalBetweenRegistrations: 5, // 5 millis,
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
