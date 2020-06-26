const prometheus = require('prom-client')
const app = require('./index')

const register = (registry, metric) => ({ ...metric, registers: [registry] })

const counters = {
  RELAYABLE_MESSAGES: 'RELAYABLE_MESSAGES',
  SIGNALD_MESSAGES: 'SIGNALD_MESSAGES',
}

const messageDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
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
    SIGNALD_MESSAGES: new prometheus.Counter({
      name: 'signald_messages',
      help: 'Counts the number of messages written out to signald sockets',
      registers: [registry],
      labelNames: ['messageType', 'channelPhoneNumber', 'messageDirection'],
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
  messageDirection,
}
