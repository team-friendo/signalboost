'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .createTable('welcomes', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
        },
        channelPhoneNumber: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        welcomedPhoneNumber: {
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
        queryInterface.addIndex('welcomes', {
          fields: ['channelPhoneNumber', 'welcomedPhoneNumber'],
          type: 'UNIQUE',
        }),
      )
      .then(() =>
        queryInterface.addIndex('welcomes', {
          fields: ['welcomedPhoneNumber', 'channelPhoneNumber'],
          type: 'UNIQUE',
        }),
      )
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('welcomes')
  },
}
