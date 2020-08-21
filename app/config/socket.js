const defaults = {
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
  poolSize: 1,
  availablePools: 12,
  bucketSize: 1000,
  tierThresholds: [1000, 250, 125, 50, 0],
}

const test = {
  ...defaults,
  connectionInterval: 10, // 10 milli
  maxConnectionAttempts: 10,
  poolSize: 5,
  availablePools: 7,
  bucketSize: 50,
  tierThresholds: [50, 20, 5, 0],
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
