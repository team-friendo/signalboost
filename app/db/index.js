const Sequelize = require('sequelize')
const { db: config } = require('../config')
const { forEach, values } = require('lodash')
const { channelOf } = require('./models/channel')
const { deauthorizationOf } = require('./models/deauthorization')
const { eventOf } = require('./models/event')
const { hotlineMessageOf } = require('./models/hotlineMessages')
const { inviteOf } = require('./models/invite')
const { membershipOf } = require('./models/membership')
const { messageCountOf } = require('./models/messageCount')
const { phoneNumberOf } = require('./models/phoneNumber')
const { smsSenderOf } = require('./models/smsSender')
const { destructionRequestOf } = require('./models/destructionRequest')
const { banSenderOf } = require('./models/ban')

const { wait } = require('../util')
const { maxConnectionAttempts, connectionInterval } = config

// () -> { Database, Sequelize, DataTypes }
const run = async () => {
  const sequelize = config.use_env_variable
    ? new Sequelize(process.env[config.use_env_variable], config)
    : new Sequelize(config.database, config.username, config.password, config)

  const db = {
    channel: channelOf(sequelize, Sequelize),
    deauthorization: deauthorizationOf(sequelize, Sequelize),
    event: eventOf(sequelize, Sequelize),
    hotlineMessage: hotlineMessageOf(sequelize, Sequelize),
    invite: inviteOf(sequelize, Sequelize),
    membership: membershipOf(sequelize, Sequelize),
    messageCount: messageCountOf(sequelize, Sequelize),
    phoneNumber: phoneNumberOf(sequelize, Sequelize),
    destructionRequest: destructionRequestOf(sequelize, Sequelize),
    smsSender: smsSenderOf(sequelize, Sequelize),
    ban: banSenderOf(sequelize, Sequelize),
  }

  forEach(values(db), mdl => mdl.associate && mdl.associate(db))

  await getDbConnection(sequelize)

  const stop = () => sequelize.close()

  return { ...db, stop, sequelize, Sequelize }
}

// (Database, number) => Promise<string>
const getDbConnection = (sequelize, attempts = 0) =>
  sequelize
    .authenticate()
    .then(() => Promise.resolve('db connected'))
    .catch(() =>
      attempts < maxConnectionAttempts
        ? wait(connectionInterval).then(() => getDbConnection(sequelize, attempts + 1))
        : Promise.reject(
            new Error(`could not connect to db after ${maxConnectionAttempts} attempts`),
          ),
    )

const stop = db => db.sequelize.close()

module.exports = { run, stop, getDbConnection }
