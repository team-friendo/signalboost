const app = require('./index')
const dispatcher = require('./services/dispatcher')
const registrar = require('./services/registrar')

const run = async () => {
  await app.initialize()
  await registrar.run(app.db, app.sock)
  await dispatcher.run()
}

run()
