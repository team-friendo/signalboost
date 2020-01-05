'use strict';

module.exports = {
  up: (queryInterface, DataTypes) => {
    return queryInterface.changeColumn('channels', 'description', {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    })
  },

  down: (queryInterface, DataTypes) => {
    return queryInterface.changeColumn('channels', 'description', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '',
    })
  }
};
