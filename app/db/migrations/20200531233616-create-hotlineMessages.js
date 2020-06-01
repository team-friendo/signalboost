'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('hotlineMessages', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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
    
    await queryInterface.addIndex('hotlineMessages', {
      fields: ['channelPhoneNumber', 'memberPhoneNumber']
    })
  
    await queryInterface.addConstraint('hotlineMessages', {
      fields: ['channelPhoneNumber', 'memberPhoneNumber'],
      type: 'unique',
    })
    
    console.log('created index!')
    
    return Promise.resolve()
  },
  
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('hotlineMessages')
  }
};
