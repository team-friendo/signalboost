const prometheus = require('prom-client')
const app = require('./index')

const register = (registry, metric) => ({ ...metric, registers: [registry] })

const _counters = {
  RELAYABLE_MESSAGES: 'RELAYABLE_MESSAGES',
  SIGNALD_MESSAGES: 'SIGNALD_MESSAGES',
  SIGNALBOOST_MESSAGES: 'SIGNALBOOST_MESSAGES',
  ERRORS: 'ERRORS',
}

const _gauges = {
  MESSAGE_ROUNDTRIP: 'MESSAGE_ROUNDTRIP',
}

const _histograms = {
  MESSAGE_ROUNDTRIP: 'MESSAGE_ROUNDTRIP',
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
  const g = _gauges
  const h = _histograms

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

  const gauges = {
    // TODO (aguestuser|2020-07-13):
    //  - `setGauge` overwrites the last gauge value and is scraped every 5 sec
    //  - thus, when we call `metrics.gauges[g.MESSAGES_ROUNDTRIP], we are throwing away:
    //    - 999 / 1000 data points in a healthy state (roundtrip ~= 300ms)
    //    - 1 / 2 data points in an unhealty state (roundtrip ~= 2 sec)
    //  - for a better solution, we'd need to:
    //    - modify `metrics.gauges[g.MESSAGES_ROUNDTRIP] to:
    //      - keep a collection of tuples of all roundtrip times and their labels
    //      - implement `collect` to (1) take the max of those times, (2) apply the labels
    //    - modify `setGauge` to mutate this collection instead of directly setting the gauge
    //  - this is complicated enough to be worth postponing for now, but because our gauge will
    //    therefore be imprecise (and potentially highly misleading), we will prefer the histogram
    //    data for now
    [g.MESSAGE_ROUNDTRIP]: new prometheus.Gauge({
      name: 'message_roundtrip_gauge',
      help:
        'Measures millis elapsed between when message is enqueued for sending with signald' +
        'and when signald confirms successful sending',
      registers: [registry],
      labelNames: ['channelPhoneNumber'],
    }),
  }

  const histograms = {
    [h.MESSAGE_ROUNDTRIP]: new prometheus.Histogram({
      name: 'message_roundtrip',
      help:
        'Measures millis elapsed between when message is enqueued for sending with signald' +
        'and when signald confirms successful sending',
      registers: [registry],
      labelNames: ['channelPhoneNumber'],
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

  return { registry, counters, gauges, histograms }
}

// (string, Array<string>) -> void
const incrementCounter = (counter, labels) => app.metrics.counters[counter].labels(...labels).inc()

// (string, number, Array<string>) -> void
const setGauge = (gauge, value, labels) => app.metrics.gauges[gauge].labels(...labels).set(value)

// (string, number, Array<string) -> void
const observeHistogram = (histogram, value, labels) =>
  app.metrics.histograms[histogram].labels(...labels).observe(value)

module.exports = {
  run,
  register,
  incrementCounter,
  setGauge,
  observeHistogram,
  counters: _counters,
  gauges: _gauges,
  histograms: _histograms,
  messageDirection,
  errorTypes,
}
