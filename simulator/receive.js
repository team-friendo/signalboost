const app = require('./app')
const { botPhoneNumbers } = require('./constants')
const { take } = require('lodash')
const { loggerOf } = require('../app/util')
const logger = loggerOf('receive')

const numBotsUnderTest = 100

;(async () => {
  const botsUnderTest = take(botPhoneNumbers, numBotsUnderTest)
  logger.log(`Starting receier with ${numBotsUnderTest} bots...`)
  await app.run(botsUnderTest)
  logger.log(`...Receiver running!`)
})()
