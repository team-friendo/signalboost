const app = require('./app')
const { mean, max, min, take, map } = require('lodash')
const { signalcPhoneNumbers, signaldPhoneNumbers, botPhoneNumbers } = require('./constants')
const { nowInMillis, nowTimestamp, loggerOf, wait } = require('../app/util')
const logger = loggerOf('testLag')

/**
 * TODO:
 * - docker-compose this ish
 * - many trials?
 * - rename db
 * - containerize signalc for loadtest
 ***/

;(async () => {
  logger.log('------ STARTING LOAD TEST -------')

  await app.run([])
  const client = process.env.TEST_SUBJECT === 'sender_signalc' ? 'SIGNALC' : 'SIGNALD'
  const senderNumber = client === 'SIGNALC' ? signalcPhoneNumbers[0] : signaldPhoneNumbers[0]

  // for (const numRecipients of channelSizes) {
  for (const numRecipients of [1000]) {
    logger.log(`Running trial for ${numRecipients} on ${client} from ${senderNumber}...`)
    const report = await testSendingN(senderNumber, numRecipients, client)
    logger.log(`...Completed trial for ${numRecipients} on ${client}...`)
    print(client, report)
  }

  logger.log('------- LOAD TEST COMPLETE! -------')

  await wait(10000)
  process.exit(0)
})()

const testSendingN = async (senderNumber, numRecipients, client) => {
  const startTime = nowInMillis()
  const timesPerMessage = await Promise.all(
    map(take(botPhoneNumbers, numRecipients), async (recipientNumber, idx) => {
      logger.log(`Sending message to ${recipientNumber}...`)
      const result = await app.signal.sendMessage(
        recipientNumber,
        sdMessageOf({
          sender: senderNumber,
          recipient: recipientNumber,
          message: `test message ${idx}`,
        }),
      )
      logger.log(`...sent message to ${recipientNumber}!`)
      return result
    }),
  )
  const endTime = nowInMillis()
  const nonNullTimes = timesPerMessage.filter(Boolean)

  return {
    client,
    numRecipients,
    timestamp: nowTimestamp(),
    socketPoolSize: process.env.SOCKET_POOL_SIZE,
    totalElapsed: endTime - startTime,
    minElapsed: min(nonNullTimes),
    maxElapsed: max(nonNullTimes),
    meanElapsed: mean(nonNullTimes),
    elapsedPerMessage: timesPerMessage,
  }
}

const sdMessageOf = ({ sender, recipient, message, attachments }) => ({
  type: 'send',
  username: sender,
  recipientAddress: { number: recipient },
  messageBody: message,
  attachments: attachments || [],
})

const print = (client, report) => {
  console.log('\n\n')
  console.log(`------------------ ${client} REPORT -------------------`)
  console.log(JSON.stringify(report, null, '  '))
  console.log('----------------------------------------------------')
}
