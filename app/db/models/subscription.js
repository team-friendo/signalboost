const { isPhoneNumber } = require('../validations')

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
    },
    {},
  )
  subscription.associate = db => {
    subscription.belongsTo(db.channel)
  }

  return subscription
}

module.exports = { subscriptionOf }
