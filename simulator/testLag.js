const app = require('./app')
const { testSendingN, print } = require('./helpers')
const { max, min, round } = require('lodash')
const { signalcPhoneNumbers, signaldPhoneNumbers } = require('./constants')
const { nowTimestamp, loggerOf, wait } = require('../app/util')
const logger = loggerOf('testLag')

const numRecipients = 100

;(async () => {
  logger.log('STARTING LOAD TEST...')

  const client = process.env.TEST_SUBJECT === 'sender_signalc' ? 'SIGNALC' : 'SIGNALD'
  const senderNumber = client === 'SIGNALC' ? signalcPhoneNumbers[0] : signaldPhoneNumbers[0]

  await app.run([senderNumber])
  await wait(2000)
  // TODO: test different numbers here
  const { totalElapsed, elapsedPerMessage } = await testSendingN(
    app,
    senderNumber,
    numRecipients,
    client,
    'testLag',
  )
  print('LAG IN SEC', reportOf(client, numRecipients, totalElapsed, elapsedPerMessage))

  logger.log('... LOAD TEST COMPLETE!')
  await wait(1000 * 5)
  process.exit(0)
})()

const reportOf = (client, numRecipients, totalElapsed, elapsedPerMessage) => {
  const nonNullTimes = elapsedPerMessage.filter(Boolean)
  const fmt = millis => round(millis / 1000, 3)
  return {
    client,
    numRecipients,
    socketPoolSize: process.env.SOCKET_POOL_SIZE,
    timestamp: nowTimestamp(),
    percentDelivered: round((nonNullTimes.length / elapsedPerMessage.length) * 100, 3),
    minElapsed: fmt(min(nonNullTimes)),
    maxElapsed: fmt(max(nonNullTimes)),
    variance: fmt(max(nonNullTimes) - min(nonNullTimes)),
    totalElapsed: fmt(totalElapsed),
    // elapsedPerMessage,
  }
}
