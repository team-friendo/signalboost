import { EventEmitter } from 'events'

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

const sockResource = () => {
  const res = new EventEmitter().setMaxListeners(30)
  res.stop = defaultResource.stop
  res.write = (msg, cb) => cb(null, true)
  return res
}

const metricsRegistryResource = () => ({
  run: () => ({
    metrics: () => Promise.resolve(),
  }),
})

module.exports = {
  db: stubOf(dbResource),
  sock: stubOf(sockResource()),
  api: stubOf(defaultResource),
  metricsRegistry: metricsRegistryResource(),
  jobs: stubOf(defaultResource),
  dispatcher: stubOf(defaultResource),
}
