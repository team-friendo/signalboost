const app = require('./app')
const { mean, max, min, take, map } = require('lodash')
const {
  signalcPhoneNumbers,
  signaldPhoneNumbers,
  botPhoneNumbers,
  numBots,
} = require('./constants')
const { nowInMillis, nowTimestamp, loggerOf, wait } = require('../app/util')
const logger = loggerOf('testLag')

;(async () => {
  logger.log('------ STARTING LOAD TEST -------')
  await app.run([])

  const client = process.env.TEST_SUBJECT === 'sender_signalc' ? 'SIGNALC' : 'SIGNALD'
  const senderNumber = client === 'SIGNALC' ? signalcPhoneNumbers[0] : signaldPhoneNumbers[0]
  // TODO: test different numbers here
  await testSendingN(senderNumber, numBots, client)

  logger.log('------- LOAD TEST COMPLETE! -------')
  await wait(1000 * 2)
  process.exit(0)
})()

const testSendingN = async (senderNumber, numRecipients, client) => {
  const startTime = nowInMillis()
  logger.log(`Running trial for ${numRecipients} on ${client} from ${senderNumber}...`)

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
  logger.log(`...Completed trial for ${numRecipients} on ${client}...`)

  print(reportOf(client, numRecipients, timesPerMessage, endTime - startTime))
}

const reportOf = (client, numRecipients, elapsedPerMessage, totalElapsed) => {
  const nonNullTimes = elapsedPerMessage.filter(Boolean)
  return {
    client,
    numRecipients,
    socketPoolSize: process.env.SOCKET_POOL_SIZE,
    timestamp: nowTimestamp(),
    totalElapsed,
    minElapsed: min(nonNullTimes),
    maxElapsed: max(nonNullTimes),
    meanElapsed: mean(nonNullTimes),
    elapsedPerMessage,
  }
}

const sdMessageOf = ({ sender, recipient, message, attachments }) => ({
  type: 'send',
  username: sender,
  recipientAddress: { number: recipient },
  messageBody: message,
  attachments: attachments || [],
})

const print = report => {
  console.log('\n\n')
  console.log(`------------------ LAG REPORT -------------------`)
  console.log(JSON.stringify(report, null, '  '))
  console.log('----------------------------------------------------')
}