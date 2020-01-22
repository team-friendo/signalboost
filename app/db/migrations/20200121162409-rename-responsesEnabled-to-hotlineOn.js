'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('channels', 'responsesEnabled', 'hotlineOn')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('channels', 'hotlineOn', 'responsesEnabled')  
  }
};