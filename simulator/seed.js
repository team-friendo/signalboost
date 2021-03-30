const app = require('./index')
const { range, map, last } = require('lodash')
const { logger, wait } = require('../app/util')

/**
 * bot subscribers:  10000000000 and up
 * signalc channels: 20000000000 and up
 * signald channels: 23000000000 and up
 **/

const firstBotNumber = 10000000000
const desiredBots = 10
const maxBotNumber = firstBotNumber + desiredBots
const batchSize = 10
const interval = 1000 * 5 // 5 sec

const seed = async (signalService, firstBotNumber) => {
  if (firstBotNumber >= maxBotNumber) return Promise.resolve()

  const botPhoneNumbers = map(range(firstBotNumber, firstBotNumber + batchSize), pn => `+${pn}`)
  const lastBotNumber = last(botPhoneNumbers)

  logger.log(`Seeding from ${firstBotNumber} to ${lastBotNumber}...`)
  await Promise.all(botPhoneNumbers.map(signalService.registerAndVerify)).catch(logger.fatalError)
  logger.log(`...seeded from ${firstBotNumber} to ${lastBotNumber}!`)

  await wait(interval)
  return seed(signalService, firstBotNumber + batchSize)
}

const run = async () => {
  await app.run()
  return seed({
    signalService: require('./signal'),
    firstBotNumber,
    maxBotNumber: firstBotNumber + desiredBots,
    batchSize,
    interval,
  })
}

run().then(() => {
  console.log('Finished seeding!')
  process.exit(0)
})
