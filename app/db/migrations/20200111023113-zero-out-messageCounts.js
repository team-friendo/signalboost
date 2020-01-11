'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {

    return queryInterface.sequelize.query(
      `UPDATE "messageCounts"
           SET "broadcastIn"  = 0,
               "broadcastOut" = 0,
               "hotlineIn"    = 0,
               "hotlineOut"   = 0,
               "commandIn"    = 0,
               "commandOut"   = 0`
    )
  },

  down: () => {
    return Promise.resolve()
  }
};
