const defaults = {
  healthcheckInterval: 1000 * 60 * 5, // 5 min
  hotlineMessageExpiryInMillis: 1000 * 60 * 60 * 24 * 28, // 4 weeks
  inviteDeletionInterval: 1000 * 60 * 60, // 1 hour
  inviteExpiryInMillis: 1000 * 60 * 60 * 24 * 14, // 2 weeks
  recycleInterval: 1000 * 60 * 60, // 1 hr
  recycleGracePeriod: 1000 * 60 * 60 * 24, // 1 day
  signaldStartupTime: 3000 * 60, // 3 min
}

const testInterval = 50

const development = {
  ...defaults,
  healthcheckInterval: 1000 * 10, // 10 sec
  recycleInterval: 1000 * 5, // 5 secs
  recycleGracePeriod: 1000 * 30, // 30 sec
  signaldStartupTime: 1000 * 5, // 5 sec
}

const test = {
  ...defaults,
  testInterval,
  healthcheckInterval: testInterval, // millis
  inviteDeletionInterval: testInterval,
  recycleInterval: testInterval,
  signaldStartupTime: 1, //  millis
  inviteExpiryInMillis: 200, // 200 millis
}

module.exports = {
  development,
  test,
  production: defaults,
}
