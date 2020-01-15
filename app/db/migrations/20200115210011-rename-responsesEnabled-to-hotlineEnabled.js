'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('channels', 'responsesEnabled', 'hotlineEnabled')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('channels', 'hotlineEnabled', 'responsesEnabled')  
  }
};
