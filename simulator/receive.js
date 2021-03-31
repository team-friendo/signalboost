const app = require('./app')
const { botPhoneNumbers, numBots } = require('./constants')
const { take } = require('lodash')
const { loggerOf } = require('../app/util')
const logger = loggerOf('receive')

// NOTE: it is better for repeat runs if we always register the receiver
// to subscribe to the total number of bots we have, rather than whatever
// subset is currently under test.

;(async () => {
  const botsUnderTest = take(botPhoneNumbers, numBots)
  logger.log(`Starting receiver with ${numBots} bots...`)
  await app.run(botsUnderTest)
  logger.log(`...Receiver running!`)
})()
