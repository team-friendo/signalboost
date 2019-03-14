// TODO: elminate call to 'dotenv' once tests are dockerized...
require('dotenv').config()
const { get } = require('lodash')
const dbConfigsByEnv = require('./db.json')
const twilioConfigsByEnv = require('./twilio')
const orchestratorConfigsByEnv = require('./orchestrator')
const signalConfigsByEnv = require('./signal')
const dbusConfigsByEnv = require('./dbus')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  projectRoot: process.env.PROJECT_ROOT,
  channelPhoneNumber: process.env.CHANNEL_PHONE_NUMBER,
  channelName: process.env.CHANNEL_NAME,
  db: getConfig(dbConfigsByEnv),
  dbus: getConfig(dbusConfigsByEnv),
  twilio: getConfig(twilioConfigsByEnv),
  orchestrator: getConfig(orchestratorConfigsByEnv),
  signal: getConfig(signalConfigsByEnv),
}
