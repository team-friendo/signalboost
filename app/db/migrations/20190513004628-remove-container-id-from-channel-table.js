'use strict'

module.exports = {
  up: queryInterface => {
    return queryInterface.removeColumn('channels', 'containerId')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('channels', 'containerId', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },
}
