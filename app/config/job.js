const defaults = {
  recycleInterval: 1000 * 60 * 60, // 1 hr
  recycleGracePeriod: 1000 * 60 * 60 * 24, // 1 day
  inviteDeletionInterval: 1000 * 60 * 60, // 1 hour
  inviteExpiryInMillis: 1000 * 60 * 60 * 24 * 14, // 2 weeks
  hotlineMessageExpiryInMillis: 1000 * 60 * 60 * 24 * 28, // 4 weeks
}

const development = {
  ...defaults,
  recycleInterval: 1000 * 5, // 5 secs
  recycleGracePeriod: 1000 * 30, // 30 sec
}

const test = {
  ...defaults,
  inviteDeletionInterval: 100, // 100 millis
  inviteExpiryInMillis: 200, // 200 millis
}

module.exports = {
  development,
  test,
  production: defaults,
}
