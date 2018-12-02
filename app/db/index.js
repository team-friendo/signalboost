const Sequelize = require('sequelize')
const { db: config } = require('../config')
const { forEach, values } = require('lodash')
const { channelOf } = require('./models/channel')
const { subscriptionOf } = require('./models/subscription')

const initDb = () => {
  const sequelize = config.use_env_variable
    ? new Sequelize(process.env[config.use_env_variable], config)
    : new Sequelize(config.database, config.username, config.password, config)

  const db = {
    channel: channelOf(sequelize, Sequelize),
    subscription: subscriptionOf(sequelize, Sequelize),
  }

  forEach(values(db), mdl => mdl.associate && mdl.associate(db))

  return { ...db, sequelize, Sequelize }
}

module.exports = { initDb }
