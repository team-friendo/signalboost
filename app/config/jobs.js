const defaults = {
  channelTimeToLive: 1000 * 60 * 60 * 24 * 28, // 4 weeks
  channelDestructionInterval: 1000 * 60 * 60, // 1 hr
  channelDestructionGracePeriod: 1000 * 60 * 60 * 24, // 1 day
  healthcheckInterval: 1000 * 60 * 15, // 15 min
  hotlineMessageExpiryInMillis: 1000 * 60 * 60 * 24 * 28, // 4 weeks
  inviteDeletionInterval: 1000 * 60 * 60, // 1 hour
  inviteExpiryInMillis: 1000 * 60 * 60 * 24 * 14, // 2 weeks
  signaldStartupTime: 3000 * 60, // 3 min
}

const testInterval = 50

const development = {
  ...defaults,
  channelTimeToLive: 1000 * 60 * 60 * 24 * 365 * 2, // 2 yr
  channelDestructionInterval: 1000 * 60 * 60 * 24, // 1 day
  channelDestructionGracePeriod: 1000 * 60 * 60 * 24 * 28, //  4 weeks
  healthcheckInterval: 1000 * 60 * 30, // 30 min
  signaldStartupTime: 1000 * 5, // 5 sec
}

const test = {
  ...defaults,
  testInterval,
  channelTimeToLive: testInterval,
  channelDestructionInterval: testInterval,
  healthcheckInterval: testInterval, // millis
  inviteDeletionInterval: testInterval,
  signaldStartupTime: 1, //  millis
  inviteExpiryInMillis: 200, // 200 millis
}

module.exports = {
  development,
  test,
  production: defaults,
}
