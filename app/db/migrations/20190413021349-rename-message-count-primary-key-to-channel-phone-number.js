'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('messageCounts', 'phoneNumber', 'channelPhoneNumber')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('messageCounts', 'channelPhoneNumber', 'phoneNumber')
  },
};
