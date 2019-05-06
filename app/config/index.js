// TODO: elminate call to 'dotenv' once tests are dockerized...
require('dotenv').config()
const { get } = require('lodash')
const dbConfigsByEnv = require('./db.json')
const twilioConfigsByEnv = require('./twilio')
const apiConfigsByEnv = require('./api')
const signalConfigsByEnv = require('./signal')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  projectRoot: process.env.PROJECT_ROOT,
  channelPhoneNumber: process.env.CHANNEL_PHONE_NUMBER || '+12223334444',
  channelName: process.env.CHANNEL_NAME || 'this channel',
  db: getConfig(dbConfigsByEnv),
  twilio: getConfig(twilioConfigsByEnv),
  api: getConfig(apiConfigsByEnv),
  signal: getConfig(signalConfigsByEnv),
}
