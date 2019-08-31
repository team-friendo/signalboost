'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('channels', 'responsesEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('channels', 'responsesEnabled')
  },
}
