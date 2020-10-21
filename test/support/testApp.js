import { EventEmitter } from 'events'
import dispatcher from '../../app/dispatcher'
import { createPool } from 'generic-pool'
import { times } from 'lodash'
const {
  socket: { poolSize, availableSockets },
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

const socketPoolsResource = () =>
  times(availableSockets, () => {
    const pool = createPool(
      {
        create: () => {
          const sock = new EventEmitter().setMaxListeners(0)
          sock.on('data', dispatcher.dispatch)
          sock.write = (msg, cb) => cb(null, true)
          return sock
        },
        destroy: x => x.removeAllListeners(),
      },
      { min: poolSize, max: poolSize },
    )
    pool.stop = () => Promise.resolve()
    return pool
  })

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
  socketPools: stubOf(socketPoolsResource()),
  api: stubOf(defaultResource),
  metrics: metricsResource(),
  jobs: stubOf(defaultResource),
  signal: stubOf(defaultResource),
}
