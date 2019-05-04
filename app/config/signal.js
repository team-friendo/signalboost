const defaults = {
  verificationTimeout: 30000, // 30 seconds
  keystorePath: '/root/.config/signal/data', // given by docker-compose file(s)
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
}

const test = {
  verificationTimeout: 30, // 30 millis
  connectionInterval: 10, // 10 milli
  maxConnectionAttempts: 10,
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
