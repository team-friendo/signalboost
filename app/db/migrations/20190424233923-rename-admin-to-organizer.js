'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.renameTable('administrations', 'publications')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameTable('administrations', 'publications')
  }
};
