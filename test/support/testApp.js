import { EventEmitter } from 'events'
import { socketPoolOf } from '../../app/socket'
import dispatcher from '../../app/dispatcher'
import { createPool } from 'generic-pool'

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

const socketPoolResource = () =>
  socketPoolOf({
    create: () => {
      const sock = new EventEmitter().setMaxListeners(0)
      sock.on('data', dispatcher.dispatch)
      sock.write = (msg, cb) => cb(null, true)
      return sock
    },
    destroy: x => x.removeAllListeners(),
  })

const metricsResource = () => ({
  run: () => ({
    registry: {
      metrics: () => Promise.resolve(),
    },
    counters: {
      ERRORS: {
        labels: () => ({
          inc: () => ({}),
        }),
      },
      RELAYABLE_MESSAGES: {
        labels: () => ({
          inc: () => ({}),
        }),
      },
      SIGNALD_MESSAGES: {
        labels: () => ({
          inc: () => ({}),
        }),
      },
    },
  }),
})

module.exports = {
  db: stubOf(dbResource),
  socketPool: stubOf(socketPoolResource()),
  api: stubOf(defaultResource),
  metrics: metricsResource(),
  jobs: stubOf(defaultResource),
  signal: stubOf(defaultResource),
}
