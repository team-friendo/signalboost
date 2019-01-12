const Sequelize = require('sequelize')
const { db: config } = require('../config')
const { forEach, values } = require('lodash')
const { administrationOf } = require('./models/administration')
const { channelOf } = require('./models/channel')
const { phoneNumberOf } = require('./models/phoneNumber')
const { subscriptionOf } = require('./models/subscription')

const initDb = () => {
  const sequelize = config.use_env_variable
    ? new Sequelize(process.env[config.use_env_variable], config)
    : new Sequelize(config.database, config.username, config.password, config)

  const db = {
    administration: administrationOf(sequelize, Sequelize),
    channel: channelOf(sequelize, Sequelize),
    phoneNumber: phoneNumberOf(sequelize, Sequelize),
    subscription: subscriptionOf(sequelize, Sequelize),
  }

  forEach(values(db), mdl => mdl.associate && mdl.associate(db))

  return { ...db, sequelize, Sequelize }
}

module.exports = { initDb }
