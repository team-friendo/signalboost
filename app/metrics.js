const prometheus = require('prom-client')
const app = require('./index')
const { redact } = require('./util')

const _counters = {
  RELAYABLE_MESSAGES: 'RELAYABLE_MESSAGES',
  SIGNALD_MESSAGES: 'SIGNALD_MESSAGES',
  SIGNALBOOST_MESSAGES: 'SIGNALBOOST_MESSAGES',
  ERRORS: 'ERRORS',
}

const _histograms = {
  MESSAGE_ROUNDTRIP: 'MESSAGE_ROUNDTRIP',
}

const _gauges = {
  CHANNEL_HEALTH: 'CHANNEL_HEALTH',
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
  const register = new prometheus.Registry()
  prometheus.collectDefaultMetrics({ register })
  const c = _counters
  const g = _gauges
  const h = _histograms

  const counters = {
    [c.ERRORS]: new prometheus.Counter({
      name: 'errors',
      help: 'Counts errors',
      registers: [register],
      labelNames: ['errorType', 'channel'],
    }),
    [c.RELAYABLE_MESSAGES]: new prometheus.Counter({
      name: 'relayable_messages',
      help: 'Counts the number of relayed messages',
      registers: [register],
      labelNames: ['channel'],
    }),
    [c.SIGNALD_MESSAGES]: new prometheus.Counter({
      name: 'signald_messages',
      help: 'Counts the number of messages written out to signald sockets',
      registers: [register],
      labelNames: ['messageType', 'channel', 'messageDirection'],
    }),
    [c.SIGNALBOOST_MESSAGES]: new prometheus.Counter({
      name: 'signalboost_messages',
      help:
        'Counts signalboost messages dispatched by messenger.\n' +
        'Message types include: broadcasts, hotline messages, hotline replies, and commands.',
      registers: [register],
      labelNames: ['channel', 'messageType', 'messageSubtype'],
    }),
  }

  const gauges = {
    [g.CHANNEL_HEALTH]: new prometheus.Gauge({
      name: 'channel_health',
      help: 'Response time to health check message (0 indicates no response)',
      registers: [register],
      labelNames: ['channelPhoneNumber'],
    }),
  }

  const histograms = {
    [h.MESSAGE_ROUNDTRIP]: new prometheus.Histogram({
      name: 'message_roundtrip',
      help:
        'Measures millis elapsed between when message is enqueued for sending with signald' +
        'and when signald confirms successful sending',
      registers: [register],
      labelNames: ['channel'],
      // buckets increase exponentially by power of 4 from base of 500 millis
      buckets: [
        500, // .5 sec
        2000, // 2 sec
        8000, // 8 sec
        32000, // 32 sec
        128000, // ~2 min
        512000, // ~8 min
        2048000, // ~34 min
        8092000, // ~2 hr
      ],
    }),
  }

  return { register, counters, gauges, histograms }
}

// (string, Array<string>) -> void
const incrementCounter = (counter, labels) =>
  app.metrics.counters[counter].labels(...labels.map(redact)).inc()

// (string, number, Array<string) -> void
const observeHistogram = (histogram, value, labels) =>
  app.metrics.histograms[histogram].labels(...labels.map(redact)).observe(value)

// (string, number, Array<string>) -> void
const setGauge = (gauge, value, labels) =>
  app.metrics.gauges[gauge].labels(...labels.map(redact)).set(value)

module.exports = {
  run,
  incrementCounter,
  observeHistogram,
  setGauge,
  counters: _counters,
  gauges: _gauges,
  histograms: _histograms,
  messageDirection,
  errorTypes,
}
