const { isPhoneNumber } = require('../validations')

const administrationOf = (sequelize, DataTypes) => {
  const administration = sequelize.define(
    'administration',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      humanPhoneNumber: {
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

  administration.associate = db => {
    administration.belongsTo(db.channel)
  }

  return administration
}

module.exports = { administrationOf }
