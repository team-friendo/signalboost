const { isPhoneNumber } = require('../validations/phoneNumber')

const channelOf = (sequelize, DataTypes) => {
  const channel = sequelize.define('channel', {
    phoneNumber: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
      validate: isPhoneNumber,
    },
    name: {
      type: DataTypes.STRING,
    },
    responsesEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
  })

  channel.associate = db => {
    channel.hasMany(db.membership, {
      hooks: true,
      onDelete: 'cascade',
    })

    channel.hasOne(db.messageCount, {
      hooks: true,
      onDelete: 'cascade',
    })
  }

  return channel
}

module.exports = { channelOf }
