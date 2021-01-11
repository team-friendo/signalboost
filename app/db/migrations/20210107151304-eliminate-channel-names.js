'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('channels', 'name')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('channels', 'name', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '',
    })
  }
};
