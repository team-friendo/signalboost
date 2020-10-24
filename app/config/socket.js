const defaults = {
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
  poolSize: 4,
  availableSockets: 10,
  subscribersPerSocket: 1000,
  tierThresholds: [1000, 250, 125, 50, 0],
}

const test = {
  ...defaults,
  connectionInterval: 10, // 10 milli
  maxConnectionAttempts: 10,
  poolSize: 5,
  availableSockets: 5,
  subscribersPerSocket: 50,
  tierThresholds: [250, 100, 50, 0],
}

const development = {
  availableSockets: 5,
}

module.exports = {
  development,
  test,
  production: defaults,
}
