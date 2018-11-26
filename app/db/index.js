const Sequelize = require('sequelize')
const { db: config } = require('../config/index')
const { forEach, values } = require('lodash')

const initDb = () => {
  const sequelize = config.use_env_variable
        ? new Sequelize(process.env[config.use_env_variable], config)
        : new Sequelize(config.database, config.username, config.password, config)

  const db = {}

  forEach(values(db), mdl => mdl.associate && mdl.associate(db))

  return { ...db, sequelize, Sequelize }
}

module.exports = { initDb }
