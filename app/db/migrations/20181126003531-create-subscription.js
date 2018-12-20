'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .createTable('subscriptions', {
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
          type: Sequelize.DATE,
          allowNull: false,
        },
      })
      .then(() =>
        queryInterface.addIndex('subscriptions', {
          fields: ['humanPhoneNumber', 'channelPhoneNumber'],
          type: 'UNIQUE',
        }),
      )
      .then(() =>
        queryInterface.addIndex('subscriptions', {
          fields: ['channelPhoneNumber', 'humanPhoneNumber'],
          type: 'UNIQUE',
        }),
      )
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('subscriptions')
  },
}
