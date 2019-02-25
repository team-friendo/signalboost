const dispatcher = require('./index')
import { initDb } from '../../db'
const { channelPhoneNumber } = require('../config')

dispatcher.run(initDb())
console.log(`> Dispatcher listening on channel: ${channelPhoneNumber}...`)
