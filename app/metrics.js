const prometheus = require('prom-client')
const app = require('./index')

const register = (registry, metric) => ({ ...metric, registers: [registry] })

const _counters = {
  RELAYABLE_MESSAGES: 'RELAYABLE_MESSAGES',
  SIGNALD_MESSAGES: 'SIGNALD_MESSAGES',
  SIGNALBOOST_MESSAGES: 'SIGNALBOOST_MESSAGES',
  ERRORS: 'ERRORS',
}

const messageDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
}

const errorTypes = {
  RATE_LIMIT_RESENDING: 'RATE_LIMIT_RESENDING',
  RATE_LIMIT_ABORTING: 'RATE_LIMIT_ABORTING',
}

const run = () => {
  const registry = new prometheus.Registry()
  prometheus.collectDefaultMetrics({ registry })
  const c = _counters

  const counters = {
    [c.ERRORS]: new prometheus.Counter({
      name: 'errors',
      help: 'Counts errors',
      registers: [registry],
      labelNames: ['errorType', 'channelPhoneNumber'],
    }),
    [c.RELAYABLE_MESSAGES]: new prometheus.Counter({
      name: 'relayable_messages',
      help: 'Counts the number of relayed messages',
      registers: [registry],
      labelNames: ['channelPhoneNumber'],
    }),
    [c.SIGNALD_MESSAGES]: new prometheus.Counter({
      name: 'signald_messages',
      help: 'Counts the number of messages written out to signald sockets',
      registers: [registry],
      labelNames: ['messageType', 'channelPhoneNumber', 'messageDirection'],
    }),
    [c.SIGNALBOOST_MESSAGES]: new prometheus.Counter({
      name: 'signalboost_messages',
      help:
        'Counts signalboost messages dispatched by messenger.\n' +
        'Message types include: broadcasts, hotline messages, hotline replies, and commands.',
      registers: [registry],
      labelNames: ['channelPhoneNumber', 'messageType', 'messageSubtype'],
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
  counters: _counters,
  messageDirection,
  errorTypes,
}
