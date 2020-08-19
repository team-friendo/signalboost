const defaults = {
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
  poolSize: 5,
}

const test = {
  ...defaults,
  connectionInterval: 10, // 10 milli
  maxConnectionAttempts: 10,
  poolSize: 5,
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
