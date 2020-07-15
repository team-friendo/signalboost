require('dotenv').config()
const { get } = require('lodash')
const apiConfigsByEnv = require('./api')
const dbConfigsByEnv = require('./db.json')
const { defaultLanguage } = require('../language')
const jobConfigsByEnv = require('./job')
const signalConfigsByEnv = require('./signal')
const socketConfigsByEnv = require('./socket')
const twilioConfigsByEnv = require('./twilio')
const cryptoConfigsByEnv = require('./crypto')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  api: getConfig(apiConfigsByEnv),
  crypto: getConfig(cryptoConfigsByEnv),
  db: getConfig(dbConfigsByEnv),
  defaultLanguage,
  job: getConfig(jobConfigsByEnv),
  projectRoot: process.env.PROJECT_ROOT,
  signal: getConfig(signalConfigsByEnv),
  socket: getConfig(socketConfigsByEnv),
  twilio: getConfig(twilioConfigsByEnv),
}
