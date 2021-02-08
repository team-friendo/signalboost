const app = require('../index')
const util = require('../util')
const { subscribe, broadcastMessage } = require('../signal')
const { loggerOf } = util
const logger = loggerOf('load')
const { range } = require('lodash')

const run = async () => {
  const firstBotNumber = 12223334000
  const botCount = 100
  const botPhoneNumbers = range(firstBotNumber + 1, firstBotNumber + botCount).map(pn => "+" + pn)

  // logger.log(`--- Creating load test channel...`)
  // const channel = await app.db.channel.create({
  //   phoneNumber: "+12223334000",
  //   name: '#load-test'
  // })
  // logger.log(`--- Created load test channel!`)

  // logger.log(`--- Creating load test channel memberships for bot phone numbers...`)
  // for (let botPhoneNumber of botPhoneNumbers) {
  //   await app.db.membership.create({ 
  //     channelPhoneNumber: "+12223334000",
  //     memberPhoneNumber: botPhoneNumber,
  //     type: 'SUBSCRIBER'
  //   })
  // }
  // logger.log(`--- Created load test channel memberships!`)

  // logger.log(`--- Subscribing to load test channel...`)
  // await subscribe(channel.phoneNumber)
  // logger.log(`--- Subscribed to load test channel!`)

  logger.log(`--- Broadcasting message over load channel...`)
  const sdMessage = {
    type: 'send',
    username: "+12223334000",
    recipientAddress: null,
    messageBody: 'hello world!',
    attachments: [],
  }
  await broadcastMessage(botPhoneNumbers, sdMessage)
  logger.log(`--- Broadcasted message!`)
}

module.exports = { run }