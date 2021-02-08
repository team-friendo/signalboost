const { range } = require('lodash')
const { Pool } = require('pg')

const app = {
  socketPool: null,
}

app.run = async ({ socketPool, signal }) => {
  const { logger } = require('../app/util')
  const socketService = socketPool || require('./socket')
  const signalService = signal || require('./signal')

  app.socketPool = await socketService.run().catch(logger.fatalError)

  const firstBotNumber = 12223334001
  const botCount = 100
  const botPhoneNumbers = range(firstBotNumber, firstBotNumber + botCount).map(pn => "+" + pn)

  const dbPool = new Pool({
    host: 'db',
    user: 'signal',
    database: 'signal',
    password: 'password',
    port: 5432,
  })
  
  logger.log(`--- Creating ${botCount} bots...`)
  await signalService.run(botPhoneNumbers, dbPool).catch(logger.fatalError)
}

module.exports = app
