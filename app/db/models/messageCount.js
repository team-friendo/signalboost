const { isPhoneNumber } = require('../validations/phoneNumber')

const messageCountOf = (sequelize, DataTypes) => {
  const messageCount = sequelize.define(
    'messageCount',
    {
      channelPhoneNumber: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true,
        validate: isPhoneNumber,
      },
      broadcastIn: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      broadcastOut: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      commandIn: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      commandOut: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {},
  )

  messageCount.associate = db => {
    messageCount.belongsTo(db.channel)
  }

  return messageCount
}

module.exports = { messageCountOf }
