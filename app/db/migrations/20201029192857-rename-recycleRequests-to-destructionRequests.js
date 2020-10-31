'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('recycleRequests', 'destructionRequests')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('destructionRequests', 'recycleRequests' )
  }
};
