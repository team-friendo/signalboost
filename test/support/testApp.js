import { EventEmitter } from 'events'
import dispatcher from '../../app/dispatcher'
import { createPool } from 'generic-pool'
const {
  socket: { poolSize },
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

const socketPoolResource = async () => {
  const pool = await createPool(
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
}

const metricsResource = () => {
  const counterStub = { labels: () => ({ inc: () => null }) }
  const histogramStub = { labels: () => ({ observe: () => null }) }
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
    }),
  }
}

module.exports = {
  db: stubOf(dbResource),
  socketPool: stubOf(socketPoolResource()),
  api: stubOf(defaultResource),
  metrics: metricsResource(),
  jobs: stubOf(defaultResource),
  signal: stubOf(defaultResource),
}
