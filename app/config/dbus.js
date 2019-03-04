const dbus = require('dbus')

const defaults = {
  getBus: () => dbus.getBus('system'),
  connectionInterval: 1000, // 1 sec
  maxConnectionAttempts: 30, // 30 tries/ 30 seconds
}

const test = {
  ...defaults,
  getBus: () => ({ getInterval: Promise.resolve({}) }),
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
