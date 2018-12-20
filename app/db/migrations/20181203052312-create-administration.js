'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .createTable('administrations', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
        },
        humanPhoneNumber: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        channelPhoneNumber: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      })
      .then(() =>
        queryInterface.addIndex('administrations', {
          fields: ['humanPhoneNumber', 'channelPhoneNumber'],
          type: 'UNIQUE',
        }),
      )
      .then(() =>
        queryInterface.addIndex('administrations', {
          fields: ['channelPhoneNumber', 'humanPhoneNumber'],
          type: 'UNIQUE',
        }),
      )
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('administrations')
  },
}
