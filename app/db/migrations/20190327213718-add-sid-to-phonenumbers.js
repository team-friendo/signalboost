'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('phoneNumbers', 'twilioSid', {
      type: Sequelize.STRING,
    })
    return queryInterface.addIndex('phoneNumbers', {
      fields: ['twilioSid'],
      type: 'UNIQUE',
      name: 'unique-sid',
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface
      .removeColumn('phoneNumbers', 'twilioSid')
      .then(() => queryInterface.removeIndex('unique-sid'))
  },
}
