const { range } = require('lodash')

const app = {
  socketPool: null,
}

app.run = async ({ socketPool, signal }) => {
  const { logger } = require('../app/util')
  const socketService = socketPool || require('./socket')
  const signalService = signal || require('./signal')

  app.socketPool = await socketService.run().catch(logger.fatalError)

  const firstBotNumber = 12223334000
  const botCount = 10
  const botPhoneNumbers = range(firstBotNumber, firstBotNumber + botCount).map(pn => "+" + pn)
  console.log(botPhoneNumbers)
  await signalService.run(botPhoneNumbers).catch(logger.fatalError)
}

module.exports = app
