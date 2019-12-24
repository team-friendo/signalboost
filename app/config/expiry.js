const defaults = {
  inviteExpiryInMillis: 1000 * 60 * 60 * 24 * 14, // 2 weeks
}

const test = {
  inviteExpiryInMillis: 100, // 100 millis
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
