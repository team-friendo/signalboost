const dbus = require('dbus')

const defaults = () => ({
  getBus: () => dbus.getBus('system'),
})

const test = {
  getBus: () => ({
    getInterface: () => Promise.resolve(),
  }),
}

module.exports = {
  development: defaults(),
  test,
  production: defaults(),
}
