const defaults = {
  broadcastBatchInterval: 1300, // 1.3 seconds
  broadcastBatchSize: 1,
  defaultMessageExpiryTime: 60 * 60 * 24 * 7, // 1 week
  expiryUpdateDelay: 200, // 200 millis
  healtcheckInterval: 1000 * 60 * 15, // 15 min
  healthcheckTimeout: 1000 * 60 * 15, // 15 min
  intervalBetweenRegistrationBatches: 120000, // 2 minutes
  intervalBetweenRegistrations: 2000, // 2 seconds
  keystorePath: '/var/lib/signald/data', // given by docker-compose file(s)
  maxResendInterval: 64 * 60 * 1000, // 64 min (6 tries)
  maxVouchLevel: 10,
  minResendInterval: 60 * 1000, // 1 min
  registrationBatchSize: 4,
  setExpiryInterval: 2000, // 2 sec
  signaldRequestTimeout: 1000 * 10, // 10 sec
  signaldVerifyTimeout: 1000 * 30, // 30 sec
  signaldSendTimeout: 1000 * 60 * 60, // 60 min
  signaldStartupTime: 1000 * 60 * 5, // 5 minutes
  supportPhoneNumber: (process.env.SUPPORT_CHANNEL_NUMBER || '').replace(`"`, ''),
  diagnosticsPhoneNumber: (process.env.DIAGNOSTICS_CHANNEL_NUMBER || '').replace(`"`, ''),
  welcomeDelay: 3000, // 3 sec
}

const test = {
  ...defaults,
  broadcastBatchInterval: 10, // 10 millis
  broadcastBatchSize: 1,
  expiryUpdateDelay: 1, // 1 milli
  healthcheckInterval: 30, // 50 milli
  healthcheckTimeout: 30, // 50 milli
  intervalBetweenRegistrationBatches: 30, // 100 millis
  intervalBetweenRegistrations: 5, // 10 millis,
  maxResendInterval: 256, // ~ 2.5 sec,
  maxVouchLevel: 10,
  minResendInterval: 2, // 20 millis
  setExpiryInterval: 1, // 1 milli
  signaldSendTimeout: 40, // 100 millis
  signaldRequestTimeout: 10, // 20 millis
  signaldVerifyTimeout: 20, // 40 millis
  signaldStartupTime: 1, // 1 milli
  supportPhoneNumber: '+15555555555',
  welcomeDelay: 0.0001, // .0001 millis
  diagnosticsPhoneNumber: '+15554443333',
}

const development = {
  ...defaults,
  healtcheckInterval: 1000 * 60, // 60 sec
  healthcheckTimeout: 1000 * 60, // 60 sec
}

module.exports = {
  development,
  test,
  production: defaults,
}
