'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('channels', 'socketPoolId', 'socketId')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('channels', 'socketId', 'socketPoolId')
  }
};
