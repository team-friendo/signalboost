'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('messageCounts', {
      phoneNumber: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true,
      },
      broadcastIn: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      broadcastOut: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      commandIn: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      commandOut: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('messageCounts')
  },
}
