'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bans', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      channelPhoneNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: {
            tableName: 'channels',
          },
          key: 'phoneNumber',
        }
      },
      memberPhoneNumber: {
        type: Sequelize.STRING,
        allowNull: false,
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
    
    console.log('created table!')
    
    await queryInterface.addIndex('bans', {
      fields: ['channelPhoneNumber', 'memberPhoneNumber']
    })
  
    await queryInterface.addConstraint('bans', {
      fields: ['channelPhoneNumber', 'memberPhoneNumber'],
      type: 'unique',
    })
    
    console.log('created index!')
    
    return Promise.resolve()
  },
  
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('bans')
  }
};
