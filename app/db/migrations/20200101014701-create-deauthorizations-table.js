'use strict';

module.exports = {
  up: async (queryInterface, DataTypes) => {
    await queryInterface.createTable('deauthorizations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      channelPhoneNumber: {
        type: DataTypes.STRING,
        alowNull: false,
      },
      memberPhoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fingerprint: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    })
    
    return queryInterface.addIndex('deauthorizations', {
      unique: true,
      fields: ['channelPhoneNumber', 'memberPhoneNumber', 'fingerprint'],
    })
  },
  
  down: (queryInterface) => {
    return queryInterface.dropTable('deauthorizations')
  }
};
