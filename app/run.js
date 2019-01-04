const { initDb } = require('./db')
const dispatchService = require('./service/dispatch')
const apiService = require('./service/api')
const {
  channelPhoneNumber,
  api: { port },
} = require('./config')

const run = async () => {
  // CONFIG
  const db = initDb()

  // API SERVICE
  await apiService.run(db, port)
  console.log(`> API Server listening on port ${port}...`)

  // DISPATCH SERVICE
  dispatchService.run(db)
  console.log(`> Dispatch Service listening for incoming messages on ${channelPhoneNumber}...`)
}

module.exports = run
