const { map, take } = require('lodash')
const { nowInMillis, nowTimestamp, loggerOf, wait } = require('../app/util')
const { botPhoneNumbers } = require('./constants')

const testSendingN = async (app, senderNumber, numRecipients, client, test) => {
  const logger = loggerOf(test)
  const startTime = nowInMillis()

  logger.log(`Running trial for ${numRecipients} on ${client} from ${senderNumber}...`)

  try {
    const elapsedPerMessage = await Promise.all(
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
    const totalElapsed = endTime - startTime
    logger.log(`...Completed ${test} trial for ${numRecipients} on ${client}...`)

    return { totalElapsed, elapsedPerMessage }
  } catch (e) {
    logger.error(`Test run failed: ${e.message || JSON.stringify(e, null, '  ')}`)
    process.exit(1)
  }
}

const sdMessageOf = ({ sender, recipient, message, attachments }) => ({
  type: 'send',
  username: sender,
  recipientAddress: { number: recipient },
  messageBody: message,
  attachments: attachments || [],
})

const print = (test, report) => {
  console.log('\n\n')
  console.log(`------------------${test} -------------------`)
  console.log(JSON.stringify(report, null, '  '))
  console.log('----------------------------------------------------')
}

module.exports = { testSendingN, print }
