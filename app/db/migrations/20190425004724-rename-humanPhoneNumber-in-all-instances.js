'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('publications', 'humanPhoneNumber', 'publisherPhoneNumber')
    return queryInterface.renameColumn('subscriptions', 'humanPhoneNumber', 'subscriberPhoneNumber')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('publications', 'publisherPhoneNumber', 'humanPhoneNumber')
    return queryInterface.renameColumn('subscriptions', 'subscriberPhoneNumber', 'humanPhoneNumber')
  },
};
