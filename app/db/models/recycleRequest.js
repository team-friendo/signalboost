const { isPhoneNumber } = require('../validations')

const recycleRequestOf = (sequelize, Sequelize) => {
  const recycleRequest = sequelize.define('recycleRequest', {
    channelPhoneNumber: {
      type: Sequelize.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
      validate: isPhoneNumber,
      references: {
        model: {
          tableName: 'channels',
        },
        key: 'phoneNumber',
      },
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
  })

  recycleRequest.associate = db => {
    recycleRequest.belongsTo(db.channel)
  }

  return recycleRequest
}

module.exports = { recycleRequestOf }
