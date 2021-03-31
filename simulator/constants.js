const { range } = require('lodash')

// constants
const numBots = 1000
const numChannels = 10

const firstBotNumber = 10000000000
const firstSignalcNumber = 20000000000
const firstSignaldNumber = 23000000000

const format = number => `+${number}`

// exports
const botPhoneNumbers = range(firstBotNumber, firstBotNumber + numBots).map(format)
const signalcPhoneNumbers = range(firstSignalcNumber, firstSignalcNumber + numChannels).map(format)
const signaldPhoneNumbers = range(firstSignaldNumber, firstSignaldNumber + numChannels).map(format)

module.exports = {
  botPhoneNumbers,
  signalcPhoneNumbers,
  signaldPhoneNumbers,
}
