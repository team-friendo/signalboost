const { isPhoneNumber } = require('../validations/phoneNumber')

const deauthorizationOf = (sequelize, DataTypes) => {
  const deauthorization = sequelize.define(
    'deauthorization',
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
      fingerprint: {
        type: DataTypes.STRING,
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

  deauthorization.associate = db => {
    deauthorization.belongsTo(db.channel)
  }

  return deauthorization
}

module.exports = { deauthorizationOf }
