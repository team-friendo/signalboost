const prometheus = require('prom-client')
const app = require('./index')

const register = (registry, metric) => ({ ...metric, registers: [registry] })

const counters = {
  RELAYABLE_MESSAGES: 'RELAYABLE_MESSAGES',
}

const run = () => {
  const registry = new prometheus.Registry()
  prometheus.collectDefaultMetrics({ registry })

  const counters = {
    RELAYABLE_MESSAGES: new prometheus.Counter({
      name: 'relayable_messages',
      help: 'Counts the number of relayed messages',
      registers: [registry],
      labelNames: ['channelPhoneNumber'],
    }),
  }

  return { registry, counters }
}

// (string, [string]) -> void
const incrementCounter = (counter, labels) => app.metrics.counters[counter].labels(...labels).inc()

module.exports = {
  run,
  register,
  incrementCounter,
  counters,
}
