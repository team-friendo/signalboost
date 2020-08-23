'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('events', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      type: {
        allowNull: false,
        type: Sequelize.ENUM,
        values: ['CHANNEL_CREATED', 'CHANNEL_DESTROYED', 'MEMBER_CREATED', 'MEMBER_DESTROYED'],
      },
      phoneNumberHash: {
        allowNull: false,
        type: Sequelize.STRING,
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
    
    return queryInterface.addIndex('events', {
      fields: ['phoneNumberHash']
    })
  },

  down: queryInterface => {
    return queryInterface.dropTable('events')
  }
};
