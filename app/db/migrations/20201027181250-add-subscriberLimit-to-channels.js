'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('channels', 'subscriberLimit', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 500,
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('channels', 'subscriberLimit')
  }
};
