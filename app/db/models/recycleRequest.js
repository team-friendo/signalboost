const { isPhoneNumber } = require('../validations')

const recycleRequestOf = (sequelize, Sequelize) =>
  sequelize.define('recycleRequest', {
    phoneNumber: {
      type: Sequelize.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
      validate: isPhoneNumber,
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

module.exports = { recycleRequestOf }
