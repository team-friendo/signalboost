const defaults = {
  broadcastBatchInterval: 1300, // 1.3 seconds
  broadcastBatchSize: 1,
  defaultMessageExpiryTime: 60 * 60 * 24 * 7, // 1 week
  expiryUpdateDelay: 200, // 200 millis
  intervalBetweenRegistrationBatches: 120000, // 2 minutes
  intervalBetweenRegistrations: 2000, // 2 seconds
  keystorePath: '/var/lib/signald/data', // given by docker-compose file(s)
  maxResendInterval: 64 * 60 * 1000, // 64 min (6 tries)
  maxVouchLevel: 10,
  minResendInterval: 60 * 1000, // 1 min
  poolSize: 50,
  registrationBatchSize: 5,
  setExpiryInterval: 2000, // 2 sec
  signaldRequestTimeout: 10000, // 10 sec
  signaldSendTimeout: 1000 * 60 * 1, //1000 * 60 * 60, // 1 hr
  signaldStartupTime: 1000 * 60 * 30, // 30 minutes
  supportPhoneNumber: process.env.SUPPORT_CHANNEL_NUMBER,
  verificationTimeout: 30000, // 30 seconds
  welcomeDelay: 3000, // 3 sec
}

const test = {
  ...defaults,
  broadcastBatchInterval: 10, // 10 millis
  broadcastBatchSize: 1,
  expiryUpdateDelay: 1, // 1 milli
  intervalBetweenRegistrationBatches: 30, // 100 millis
  intervalBetweenRegistrations: 5, // 10 millis,
  maxResendInterval: 256, // ~ 2.5 sec,
  maxVouchLevel: 10,
  minResendInterval: 2, // 20 millis
  poolSize: 30,
  setExpiryInterval: 1, // 1 milli
  signaldSendTimeout: 200, // 200 millis
  signaldRequestTimeout: 100, // 100 millis
  signaldStartupTime: 1, // 1 milli
  supportPhoneNumber: '+15555555555',
  verificationTimeout: 30, // 30 millis
  welcomeDelay: 0.0001, // .0001 millis
}

const development = {
  ...defaults,
  supportPhoneNumber: process.env.SUPPORT_CHANNEL_NUMBER_DEV,
}

module.exports = {
  development,
  test,
  production: defaults,
}
