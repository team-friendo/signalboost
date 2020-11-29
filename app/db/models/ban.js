const { isPhoneNumber } = require('../validations')

const banOf = (sequelize, DataTypes) => {
  const ban = sequelize.define(
    'ban',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      channelPhoneNumber: {
        type: DataTypes.STRING,
        validate: isPhoneNumber,
        alowNull: false,
      },
      memberPhoneNumber: {
        type: DataTypes.STRING,
        validate: isPhoneNumber,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {},
  )

  ban.associate = db => {
    ban.belongsTo(db.channel)
  }

  return ban
}

module.exports = { banOf }
