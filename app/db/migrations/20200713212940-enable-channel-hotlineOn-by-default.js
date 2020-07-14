'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
   return queryInterface.changeColumn('channels', 'hotlineOn', {
     type: Sequelize.BOOLEAN,
     allowNull: true,
     defaultValue: true,
   })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('channels', 'hotlineOn', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    })
  }
};
