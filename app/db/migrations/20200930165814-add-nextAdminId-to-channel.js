'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('channels', 'nextAdminId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    })  
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('channels', 'nextAdminId')
  }
};
