require('dotenv').config()
const { get } = require('lodash')
const dbConfigsByEnv = require('./db.json')
const twilioConfigsByEnv = require('./twilio')
const apiConfigsByEnv = require('./api')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  db: getConfig(dbConfigsByEnv),
  twilio: getConfig(twilioConfigsByEnv),
  api: getConfig(apiConfigsByEnv),
  channelPhoneNumber: process.env.CHANNEL_PHONE_NUMBER,
}
