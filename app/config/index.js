require('dotenv').config()
const { get } = require('lodash')
const dbConfigsByEnv = require('./db.json')
const twilioConfigsByEnv = require('./twilio')
const orchestratorConfigsByEnv = require('./orchestrator')
const timeConfigsByEnv = require('./time')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  db: getConfig(dbConfigsByEnv),
  twilio: getConfig(twilioConfigsByEnv),
  orchestrator: getConfig(orchestratorConfigsByEnv),
  channelPhoneNumber: process.env.CHANNEL_PHONE_NUMBER,
  time: getConfig(timeConfigsByEnv),
}
