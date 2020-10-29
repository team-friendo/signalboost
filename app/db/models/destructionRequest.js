const { isPhoneNumber } = require('../validations')

const destructionRequestOf = (sequelize, Sequelize) => {
  const destructionRequest = sequelize.define('destructionRequest', {
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

  destructionRequest.associate = db => {
    destructionRequest.belongsTo(db.channel)
  }

  return destructionRequest
}

module.exports = { destructionRequestOf }
