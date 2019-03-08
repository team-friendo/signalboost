'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('channels', 'containerId', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },

  down: queryInterface => {
    return queryInterface.removeColumn('channels', 'containerId')
  },
}
