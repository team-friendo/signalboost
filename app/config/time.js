const defaults = {
  verificationTimeout: 30000, // 30 seconds
}

const test = {
  verificationTimeout: 30, // 30 millis
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
