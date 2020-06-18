const app = require('./index')
const dispatcher = require('./services/dispatcher/run')
const registrar = require('./services/registrar/run')

const run = async () => {
  await app.initialize()
  await registrar.run(app.db, app.sock)
  await dispatcher.run()
}

run()
