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

  const firstBotNumber = 12223370000
  const botCount = 100
  const botPhoneNumbers = range(firstBotNumber, firstBotNumber + botCount).map(pn => "+" + pn)
  
  logger.log(`--- Creating ${botCount} bots...`)
  await signalService.run(botPhoneNumbers).catch(logger.fatalError)
}

module.exports = app
