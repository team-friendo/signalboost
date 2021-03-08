const defaults = {
  channelDestructionInterval: 1000 * 60 * 60, // 1 hr
  channelDestructionGracePeriod: 1000 * 60 * 60 * 24 * 3, // 3 days
  channelExpiryInMillis: 1000 * 60 * 60 * 24 * 7, // 1 week
  healthcheckInterval: 1000 * 60 * 10, // 5 min
  hotlineMessageExpiryInMillis: 1000 * 60 * 60 * 24 * 7, // 1 week
  inviteDeletionInterval: 1000 * 60 * 60, // 1 hour
  inviteExpiryInMillis: 1000 * 60 * 60 * 24 * 7, // 1 week
  shouldRunKeystoreDeletion: process.env.SHOULD_RUN_KEYSTORE_DELETION === '1',
  shouldRunHealthchecks: process.env.SHOULD_RUN_HEALTHCHECKS === '1',
}

const development = {
  ...defaults,
  channelDestructionInterval: 1000 * 60 * 60 * 24, // 1 day
  channelDestructionGracePeriod: 1000 * 60 * 60 * 24 * 28, //  4 weeks
  channelExpiryInMillis: 1000 * 60 * 60 * 24 * 365 * 2, // 2 yr
  healthcheckInterval: 1000 * 60 * 30, // 30 min
}

const testInterval = 50

const test = {
  ...defaults,
  testInterval,
  channelDestructionInterval: testInterval,
  /*** v-- comment this to run integration tests in isolation in IDE: --v ***/
  channelDestructionGracePeriod:
    process.env.INTEGRATION_TEST === '1'
      ? 12 * testInterval
      : defaults.channelDestructionGracePeriod,
  /*** v-- uncomment this to run integration tests in isolation in IDE: --v ***/
  // channelDestructionGracePeriod: 12 * testInterval,
  channelExpiryInMillis: testInterval,
  healthcheckInterval: testInterval, // millis
  inviteDeletionInterval: testInterval,
  inviteExpiryInMillis: 200, // 200 millis
  shouldRunKeystoreDeletion: true,
  shouldRunHealthchecks: true,
}

module.exports = {
  development,
  test,
  production: defaults,
}
