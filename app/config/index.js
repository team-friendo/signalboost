require('dotenv').config()
const { get } = require('lodash')
const apiConfigsByEnv = require('./api')
const authConfigsByEnv = require('./auth')
const cryptoConfigsByEnv = require('./crypto')
const dbConfigsByEnv = require('./db.json')
const { defaultLanguage } = require('../language')
const jobsConfigsByEnv = require('./jobs')
const signalConfigsByEnv = require('./signal')
const socketConfigsByEnv = require('./socket')
const twilioConfigsByEnv = require('./twilio')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  api: getConfig(apiConfigsByEnv),
  auth: getConfig(authConfigsByEnv),
  crypto: getConfig(cryptoConfigsByEnv),
  db: getConfig(dbConfigsByEnv),
  defaultLanguage,
  jobs: getConfig(jobsConfigsByEnv),
  projectRoot: process.env.PROJECT_ROOT,
  signal: getConfig(signalConfigsByEnv),
  socket: getConfig(socketConfigsByEnv),
  twilio: getConfig(twilioConfigsByEnv),
}
