const defaults = {
  inviteDeletionInterval: 1000 * 60 * 60, // 1 hour
  inviteExpiryInMillis: 1000 * 60 * 60 * 24 * 14, // 2 weeks
  hotlineMessageExpiryInMillis: 1000 * 60 * 24 * 28, // 4 weeks
}

const test = {
  ...defaults,
  inviteDeletionInterval: 100, // 100 millis
  inviteExpiryInMillis: 200, // 200 millis
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
