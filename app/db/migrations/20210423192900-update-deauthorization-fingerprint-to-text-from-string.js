'use strict';

module.exports = {
  up: (queryInterface, DataTypes) => {
    return queryInterface.changeColumn('deauthorizations', 'fingerprint', {
      type: DataTypes.TEXT,
      allowNull: false,
    })
  },

  down: (queryInterface, DataTypes) => {
    return queryInterface.changeColumn('deauthorizations', 'fingerprint', {
      type: DataTypes.STRING,
      allowNull: true,
    })
  }
};
