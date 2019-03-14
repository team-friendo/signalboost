const defaults = {
  verificationTimeout: 30000, // 30 seconds
  keystorePath: '/root/.config/signal/data', // given by docker-compose file(s)
}

const test = {
  verificationTimeout: 30, // 30 millis
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
