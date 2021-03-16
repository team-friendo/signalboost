const { util } = require('chai')
const { range, isEmpty } = require('lodash')
const { sequence, wait } = require('../app/util')

const app = {
  socketPool: null,
}

app.seed = async () => {
  await app.run()
  // const signalService = require('./signal')

  // const botPhoneNumbers = range(firstBotNumber, firstBotNumber + botCount).map(pn => "+" + pn)
  // return sequence(botPhoneNumbers.map(botPN => () => signalService.registerAndVerify(botPN))).catch(logger.fatalError)
  // return Promise.all(botPhoneNumbers.map(signalService.registerAndVerify)).catch(logger.fatalError)

  const firstBotNumber = 10000000000
  return seedOnce(firstBotNumber)
}

const seedOnce = async (firstBotNumber) => {
  const signalService = require('./signal')
  const { logger } = require('../app/util')

  if (firstBotNumber >= 10000000000) {
    return Promise.resolve()
  } else {
    const botCount = 50
    const botPhoneNumbers = range(firstBotNumber, firstBotNumber + botCount).map(pn => "+" + pn)
    console.log(`Seeding from ${firstBotNumber} to ${firstBotNumber + (botCount - 1)}...`)
    await Promise.all(botPhoneNumbers.map(signalService.registerAndVerify)).catch(logger.fatalError)
    console.log(`...seeded from ${firstBotNumber} to ${firstBotNumber + (botCount - 1)}!`)
    await wait(5000)
    return seedOnce(firstBotNumber + botCount)
  }
}


app.run = async (botPhoneNumbers = []) => {
  const { logger } = require('../app/util')
  const socketService = require('./socket')
  const signalService = require('./signal')

  app.socketPool = await socketService.run().catch(logger.fatalError)
  
  if (isEmpty(botPhoneNumbers)) return

  logger.log(`--- Subscribing ${botCount} bots...`)
  await signalService.run(botPhoneNumbers).catch(logger.fatalError)
}

app.stop = async () => {
  app.socketPool.stop()
}

module.exports = app
