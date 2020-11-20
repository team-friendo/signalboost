'use strict';

const niceware = require('niceware')
const { times, zip, map } = require('lodash')

module.exports = {
  up: async (queryInterface, Sequelize) => {

    const channels = await queryInterface.sequelize.query('select * from channels',{ type: Sequelize.QueryTypes.SELECT })
    const names = times(channels.length, () => niceware.generatePassphrase(4).join(' '))
    
    return Promise.all(
      map(zip(channels, names), ([channel,name]) => queryInterface.sequelize.query(
        `update channels set name = '${name}' where "phoneNumber" = '${channel.phoneNumber}';`,
        { type: Sequelize.QueryTypes.UPDATE }
      ))
    )
  },

  down: (queryInterface, Sequelize) => {
    return Promise.resolve()
  }
};
