const { isPhoneNumber } = require('../validations/phoneNumber')

const statuses = {
  ERROR: 'ERROR',
  PURCHASED: 'PURCHASED',
  REGISTERED: 'REGISTERED',
  VERIFIED: 'VERIFIED',
  ACTIVE: 'ACTIVE',
}

const phoneNumberOf = (sequelize, DataTypes) => {
  return sequelize.define(
    'phoneNumber',
    {
      phoneNumber: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true,
        validate: isPhoneNumber,
      },
      status: {
        type: DataTypes.ENUM,
        values: Object.values(statuses),
      },
      twilioSid: {
        type: DataTypes.STRING,
        unique: true,
      },
    },
    {},
  )
}

module.exports = { phoneNumberOf, statuses }
