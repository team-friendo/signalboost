'use strict';

module.exports = {
  up: (queryInterface, DataTypes) => {
    return queryInterface.addColumn('channels', 'vouchLevel', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('channels', 'vouchLevel')
  }
};
