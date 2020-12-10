const { defaultLanguage } = require('../../config')
const { isPhoneNumber } = require('../validations')

const membershipOf = (sequelize, DataTypes) => {
  const membership = sequelize.define(
    'membership',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      type: {
        type: DataTypes.ENUM,
        allowNull: false,
        values: ['ADMIN', 'SUBSCRIBER'],
      },
      memberPhoneNumber: {
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
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: defaultLanguage,
      },
      adminId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {},
  )

  membership.associate = db => {
    membership.belongsTo(db.channel)
  }

  return membership
}

module.exports = { membershipOf }
