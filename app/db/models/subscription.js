const { isPhoneNumber } = require('../validations/phoneNumber')
const { defaultLanguage } = require('../../config')

const subscriptionOf = (sequelize, DataTypes) => {
  const subscription = sequelize.define(
    'subscription',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      subscriberPhoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: isPhoneNumber,
      },
      channelPhoneNumber: {
        type: DataTypes.STRING,
        alowNull: false,
        validate: isPhoneNumber,
      },
      language: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: defaultLanguage,
      },
    },
    {},
  )
  subscription.associate = db => {
    subscription.belongsTo(db.channel)
  }

  return subscription
}

module.exports = { subscriptionOf }
