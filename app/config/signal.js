const defaults = {
  verificationTimeout: 30000, // 30 seconds
  keystorePath: '/var/lib/signald/data', // given by docker-compose file(s)
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
  poolMinConnections: 10,
  poolMaxConnections: 50,
  poolEvictionMillis: 30000,
  registrationBatchSize: 5,
  signaldRequestTimeout: 10000, // 10 sec
  intervalBetweenRegistrationBatches: 120000, // 2 minutes
  intervalBetweenRegistrations: 2000, // 2 seconds
  signaldStartupTime: 1000 * 60 * 5, // 5 minutes
  welcomeDelay: 3000, // 3 sec
  signupPhoneNumber: process.env.SIGNUP_CHANNEL_NUMBER,
  defaultMessageExpiryTime: 60 * 60 * 24 * 7, // 1 week
  expiryUpdateDelay: 200, // 200 millis
  setExpiryInterval: 2000, // 2 sec
  minResendInterval: 60 * 1000, // 1 min
  maxResendInterval: 64 * 60 * 1000, // 64 min (6 tries)
  broadcastBatchSize: 1,
  broadcastBatchInterval: 1300, // 1.3 seconds
  maxVouchLevel: 10,
}

const test = {
  ...defaults,
  verificationTimeout: 30, // 30 millis
  connectionInterval: 10, // 10 milli
  maxConnectionAttempts: 10,
  poolMinConnections: 0,
  signaldRequestTimeout: 100, // 100 millis
  intervalBetweenRegistrationBatches: 30, // 100 millis
  intervalBetweenRegistrations: 5, // 10 millis,
  signaldStartupTime: 1, // 1 milli
  welcomeDelay: 0.0001, // .0001 millis
  signupPhoneNumber: '+15555555555',
  expiryUpdateDelay: 1, // 1 milli
  setExpiryInterval: 1, // 1 milli
  minResendInterval: 2, // 20 millis
  maxResendInterval: 256, // ~ 2.5 sec,
  broadcastBatchSize: 1,
  broadcastBatchInterval: 10, // 10 millis
  maxVouchLevel: 10,
}

const development = {
  ...defaults,
  signupPhoneNumber: process.env.SIGNUP_CHANNEL_NUMBER_DEV,
}

module.exports = {
  development,
  test,
  production: defaults,
}
