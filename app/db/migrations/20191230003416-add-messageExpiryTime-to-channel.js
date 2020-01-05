'use strict';

module.exports = {
  up: (queryInterface, DataTypes) => {
    const oneWeek = 604800
    return queryInterface.addColumn('channels', 'messageExpiryTime', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: oneWeek
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('channels', 'messageExpiryTime')
  }
};
