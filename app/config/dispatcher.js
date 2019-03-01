const defaults = {
  parentContainer: 'signalboost_orchestrator',
  dbusConnectionInterval: 1000, // 1 sec
  dbusConnectionTimeout: 30000, // 30 sec
}

const test = {
  parentContainer: 'signalboost_test_runner',
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
