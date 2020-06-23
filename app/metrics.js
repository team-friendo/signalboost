const prometheus = require('prom-client')

const register = (registry, metric) => ({ ...metric, registers: [registry] })

const run = () => {
  const registry = new prometheus.Registry()
  prometheus.collectDefaultMetrics({ registry })
  return registry
}

module.exports = {
  run,
  register,
}
