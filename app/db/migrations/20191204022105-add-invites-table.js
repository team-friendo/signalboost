'use strict';

module.exports = {
  up: async (queryInterface, DataTypes) => {
    await queryInterface.createTable('invites', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      channelPhoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      inviterPhoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      inviteePhoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
    })
    return Promise.all([
      queryInterface.addIndex('invites', {
        fields: ['inviterPhoneNumber', 'inviteePhoneNumber', 'channelPhoneNumber'],
        unique: true,
      }),
      queryInterface.addIndex('invites', {
        fields: ['inviteePhoneNumber', 'channelPhoneNumber'],
      }),
    ])
  },

  down: (queryInterface) => {
    return queryInterface.dropTable('invites')
  }
};
