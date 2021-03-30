const app = require('./app')
const { botPhoneNumbers, numBots } = require('./constants')
const { take } = require('lodash')
const { loggerOf } = require('../app/util')
const logger = loggerOf('receive')

;(async () => {
  const botsUnderTest = take(botPhoneNumbers, numBots)
  logger.log(`Starting receiver with ${numBots} bots...`)
  await app.run(botsUnderTest)
  logger.log(`...Receiver running!`)
})()
