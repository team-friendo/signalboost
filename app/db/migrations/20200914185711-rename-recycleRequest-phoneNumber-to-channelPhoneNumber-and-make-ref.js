'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('recycleRequests', 'phoneNumber', 'channelPhoneNumber')
    return queryInterface.changeColumn('recycleRequests', 'channelPhoneNumber', {
      type: Sequelize.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
      // old --^
      // new --v
      references: {
        model: {
          tableName: 'channels',
        },
        key: 'phoneNumber',
      }
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('recycleRequests', 'channelPhoneNumber', {
      type: Sequelize.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
    })
    return queryInterface.renameColumn('recycleRequests', 'channelPhoneNumber', 'phoneNumber')
  }
};
