const socketService = require('./socket')
const { isEmpty } = require('lodash')

const app = {
  socketPool: null,
  signal: null,
}

app.run = async (botPhoneNumbers = []) => {
  const { logger } = require('../app/util')

  app.socketPool = await socketService.run().catch(logger.fatalError)
  app.signal = require('./signal')

  if (isEmpty(botPhoneNumbers)) return

  logger.log(`--- Subscribing ${botPhoneNumbers.length} bots...`)
  await app.signal.run(botPhoneNumbers).catch(logger.fatalError)
}

app.stop = async () => {
  app.socketPool.stop()
}

module.exports = app
