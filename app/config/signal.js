const defaults = {
  verificationTimeout: 30000, // 30 seconds
  keystorePath: '/var/lib/signald/data', // given by docker-compose file(s)
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
  registrationBatchSize: 5,
  intervalBetweenRegistrationBatches: 120000, // 2 minutes
  intervalBetweenRegistrations: 2000, // 2 seconds
  welcomeDelay: 3000, // 3 sec
}

const test = {
  ...defaults,
  verificationTimeout: 30, // 30 millis
  connectionInterval: 10, // 10 milli
  maxConnectionAttempts: 10,
  intervalBetweenRegistrationBatches: 30, // 100 millis
  intervalBetweenRegistrations: 5, // 10 millis,
  welcomeDelay: 0.0001, // .0001 millis
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
