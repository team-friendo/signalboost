const app = require('./app')
const { testSendingN, print } = require('./helpers')
const { max, min, take, round, times, flatten } = require('lodash')
const { signalcPhoneNumbers, signaldPhoneNumbers } = require('./constants')
const { nowTimestamp, loggerOf, wait } = require('../app/util')
const logger = loggerOf('testLag')

const numRecipients = 100

;(async () => {
  logger.log('STARTING LOAD TEST...')

  const client = process.env.TEST_SUBJECT === 'sender_signalc' ? 'SIGNALC' : 'SIGNALD'
  const senderNumbers =
    client === 'SIGNALC' ? take(signalcPhoneNumbers, 3) : take(signaldPhoneNumbers, 3)

  await app.run(senderNumbers)
  await wait(2000)

  const results = flatten(
    await Promise.all(
      senderNumbers.map(senderNumber =>
        Promise.all(
          times(3, () => testSendingN(app, senderNumber, numRecipients, client, 'testConcurrency')),
        ),
      ),
    ),
  ).map((x, idx) => ({ ...x, senderNumber: senderNumbers[idx] }))

  results.forEach(({ totalElapsed, elapsedPerMessage, senderNumber }) => {
    print(
      'CONCURRENT LAG IN SEC',
      reportOf(client, numRecipients, totalElapsed, elapsedPerMessage, senderNumber),
    )
  })

  await wait(2000)
  logger.log('... LOAD TEST COMPLETE!')
  await wait(2000)
  process.exit(0)
})()

const reportOf = (client, numRecipients, totalElapsed, elapsedPerMessage, senderNumber) => {
  const nonNullTimes = elapsedPerMessage.filter(Boolean)
  const fmt = millis => round(millis / 1000, 3)
  return {
    client,
    senderNumber,
    numRecipients,
    socketPoolSize: process.env.SOCKET_POOL_SIZE,
    timestamp: nowTimestamp(),
    percentDelivered: round((nonNullTimes.length / elapsedPerMessage.length) * 100, 3),
    minElapsed: fmt(min(nonNullTimes)),
    maxElapsed: fmt(max(nonNullTimes)),
    totalElapsed: fmt(totalElapsed),
    // elapsedPerMessage,
  }
}
