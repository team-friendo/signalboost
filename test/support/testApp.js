import { EventEmitter } from 'events'
import dispatcher from '../../app/dispatcher'

const { createNConnectionPools } = require('../../app/sockets')
const {
  socket: { availableSockets },
} = require('../../app/config')

const stubOf = (resource = defaultResource) => ({
  run: () => Promise.resolve(resource),
})

const defaultResource = {
  stop: () => Promise.resolve(),
}

const dbResource = {
  ...defaultResource,
  sequelize: {
    transaction: () => ({
      commit: async () => Promise.resolve(),
      rollback: async () => Promise.resolve(),
    }),
  },
}

const socketsResource = () => {
  const createPool = idx => {
    const sock = new EventEmitter().setMaxListeners(0)
    sock.on('data', dispatcher.dispatcherOf(idx))
    sock.write = (msg, cb) => cb(null, true)
    return sock
  }
  const destroyPool = emitter => emitter.removeAllListeners()
  return createNConnectionPools(availableSockets, createPool, destroyPool)
}

const metricsResource = () => {
  const counterStub = { labels: () => ({ inc: () => null }) }
  const histogramStub = { labels: () => ({ observe: () => null }) }
  const gaugueStub = { labels: () => ({ set: () => null }) }
  return {
    run: () => ({
      register: {
        metrics: () => Promise.resolve(),
      },
      counters: {
        ERRORS: counterStub,
        RELAYABLE_MESSAGES: counterStub,
        SIGNALD_MESSAGES: counterStub,
        SIGNALBOOST_MESSAGES: counterStub,
        SYSTEM_LOAD: counterStub,
      },
      histograms: {
        MESSAGE_ROUNDTRIP: histogramStub,
      },
      gauges: {
        CHANNEL_HEALTH: gaugueStub,
      },
    }),
  }
}

module.exports = {
  db: stubOf(dbResource),
  sockets: stubOf(socketsResource()),
  api: stubOf(defaultResource),
  metrics: metricsResource(),
  jobs: stubOf(defaultResource),
  signal: stubOf(defaultResource),
}
