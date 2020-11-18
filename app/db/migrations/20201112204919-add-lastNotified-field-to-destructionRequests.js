'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('destructionRequests', 'lastNotified', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('destructionRequests', 'lastNotified')
  }
};
