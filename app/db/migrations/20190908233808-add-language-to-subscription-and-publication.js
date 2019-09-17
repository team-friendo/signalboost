'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('subscriptions', 'language', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: process.env.DEFAULT_LANGUAGE,
      }),
      queryInterface.addColumn('publications', 'language', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: process.env.DEFAULT_LANGUAGE,
      }),
    ])
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('subscriptions', 'language'),
      queryInterface.removeColumn('publications', 'language'),
    ])
  },
}
