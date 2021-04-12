'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('events','metadata',{
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('events', 'metadata')
  }
};
