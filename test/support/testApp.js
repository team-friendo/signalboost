import { EventEmitter } from 'events'
import { merge } from 'lodash'

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

const sockResource = () =>
  merge(new EventEmitter().setMaxListeners(30), {
    stop: defaultResource.stop,
    write: () => Promise.resolve(),
  })

module.exports = {
  db: stubOf(dbResource),
  sock: stubOf(sockResource()),
  registrar: stubOf(defaultResource),
  dispatcher: stubOf(defaultResource),
}
