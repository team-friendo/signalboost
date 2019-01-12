'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .createTable('phoneNumbers', {
        phoneNumber: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          unique: true,
        },
        status: {
          type: Sequelize.ENUM,
          allowNull: false,
          values: ['PURCHASED', 'REGISTERED', 'VERIFIED', 'ACTIVE', 'ERROR'],
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      })
      .then(() =>
        queryInterface.addIndex('phoneNumbers', {
          fields: ['phoneNumber', 'status'],
        }),
      )
      .then(() =>
        queryInterface.addIndex('phoneNumbers', {
          fields: ['status', 'phoneNumber'],
        }),
      )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('phoneNumbers')
  },
}
