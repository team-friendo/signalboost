const dispatcher = require('./index')
const { initDb } = require('../../db')
const { channelPhoneNumber } = require('../../config')

dispatcher.run(initDb())
console.log(`> Dispatcher listening on channel: ${channelPhoneNumber}...`)
