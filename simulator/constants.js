const { range } = require('lodash')

const numBots = 1000
const numChannels = 4
const channelSizes = [1, 10, 100, 1000]

const firstBotNumber = 10000000000
const firstSignalcNumber = 20000000000
const firstSignaldNumber = 23000000000

const format = number => `+${number}`
const botPhoneNumbers = range(firstBotNumber, firstBotNumber + numBots).map(format)
const signalcPhoneNumbers = range(firstSignalcNumber, firstSignalcNumber + numChannels).map(format)
const signaldPhoneNumbers = range(firstSignaldNumber, firstSignaldNumber + numChannels).map(format)

module.exports = {
  numBots,
  numChannels,
  channelSizes,
  botPhoneNumbers,
  signalcPhoneNumbers,
  signaldPhoneNumbers,
}
