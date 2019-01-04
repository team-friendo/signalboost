const defaults = {
  verificationTimeout: 10000, // 10 sec
}

const test = {
  verificationTimeout: 20, // 100 millis
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}