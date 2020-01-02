'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('channels', 'description', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: '',
    })
  },

  down: (queryInterface, Sequelize) => {
  	return queryInterface.removeColumn('channels', 'description')
  }
};
