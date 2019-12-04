'use strict';

module.exports = {
  up: (queryInterface, DataTypes) => {
    return queryInterface.addColumn('channels', 'vouchingOn', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('channels', 'vouchingOn')
  }
};
