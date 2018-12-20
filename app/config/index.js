require('dotenv').config()
const { get } = require('lodash')
const dbConfigsByEnv = require('./db.json')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  db: getConfig(dbConfigsByEnv),
  port: 3000,
  channelPhoneNumber: process.env.CHANNEL_PHONE_NUMBER,
}
