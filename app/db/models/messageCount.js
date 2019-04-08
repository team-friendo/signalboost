const { isPhoneNumber } = require('../validations')

const messageCountOf = (sequelize, DataTypes) => {
  return sequelize.define(
    'messageCount',
    {
      phoneNumber: {
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
}

module.exports = { messageCountOf }
