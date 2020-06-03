const { isPhoneNumber } = require('../validations/phoneNumber')
const {
  signal: { defaultMessageExpiryTime },
} = require('../../config')

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
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    messageExpiryTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: defaultMessageExpiryTime,
    },
    hotlineOn: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    vouchingOn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    vouchLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  })

  channel.associate = db => {
    channel.hasMany(db.membership, {
      hooks: true,
      onDelete: 'cascade',
    })

    channel.hasMany(db.deauthorization, {
      hooks: true,
      onDelete: 'cascade',
    })

    channel.hasMany(db.invite, {
      hooks: true,
      onDelete: 'cascade',
    })

    channel.hasOne(db.messageCount, {
      hooks: true,
      onDelete: 'cascade',
    })

    channel.hasMany(db.hotlineMessage, {
      hooks: true,
      onDelete: 'cascade',
    })
  }

  return channel
}

module.exports = { channelOf }
