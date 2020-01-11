'use strict';

module.exports = {

  up: (queryInterface, DataTypes) => {
    return Promise.all([
      queryInterface.addColumn('messageCounts', 'hotlineIn', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }),
      queryInterface.addColumn('messageCounts', 'hotlineOut', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }),
    ])
  },

  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn('messageCounts', 'hotlineIn'),
      queryInterface.removeColumn('messageCounts', 'hotlineOut'),
    ])
  }
};
