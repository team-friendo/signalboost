'use strict';

module.exports = {
  up: (queryInterface, DataTypes) => {
    return queryInterface.addColumn('channels', 'vouchThreshold', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('channels', 'vouchThreshold')
  }
};
