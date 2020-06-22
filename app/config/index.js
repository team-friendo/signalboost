require('dotenv').config()
const { get } = require('lodash')
const dbConfigsByEnv = require('./db.json')
const jobConfigsByEnv = require('./job')
const twilioConfigsByEnv = require('./twilio')
const registrarConfigsByEnv = require('./registrar')
const signalConfigsByEnv = require('./signal')
const { defaultLanguage } = require('../language')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  defaultLanguage,
  projectRoot: process.env.PROJECT_ROOT,
  db: getConfig(dbConfigsByEnv),
  job: getConfig(jobConfigsByEnv),
  twilio: getConfig(twilioConfigsByEnv),
  registrar: getConfig(registrarConfigsByEnv),
  signal: getConfig(signalConfigsByEnv),
}
