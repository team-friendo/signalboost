'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('destructionRequests', 'lastNotified', 'lastNotifiedAt')
  
    await queryInterface.addIndex('destructionRequests', {
      fields: ['lastNotifiedAt']
    })

    return queryInterface.addIndex('destructionRequests', {
      fields: ['createdAt'],
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('destructionRequests', ['createdAt'])
    await queryInterface.removeIndex('destructionRequests', ['lastNotifiedAt'])
    return queryInterface.renameColumn('destructionRequests', 'lastNotifiedAt', 'lastNotified')
  }
};
