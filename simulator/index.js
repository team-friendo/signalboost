const { isEmpty } = require('lodash')

const app = {
  socketPool: null,
}

app.run = async (botPhoneNumbers = []) => {
  const { logger } = require('../app/util')
  const socketService = require('./socket')
  const signalService = require('./signal')

  app.socketPool = await socketService.run().catch(logger.fatalError)

  if (isEmpty(botPhoneNumbers)) return

  logger.log(`--- Subscribing ${botPhoneNumbers.length} bots...`)
  await signalService.run(botPhoneNumbers).catch(logger.fatalError)
}

app.stop = async () => {
  app.socketPool.stop()
}

module.exports = app
