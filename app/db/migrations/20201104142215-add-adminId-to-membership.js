'use strict';
const { isEmpty, has } = require('lodash')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('memberships', 'adminId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    })

    const admins = await queryInterface.sequelize
      .query(`select * from memberships where type = 'ADMIN'`)
      .then(([, result]) => result.rows)

    const nextAdminId = {}

    return Promise.all(admins.map(({ id, channelPhoneNumber }) => {
      channelPhoneNumber in nextAdminId ? nextAdminId[channelPhoneNumber]++ : nextAdminId[channelPhoneNumber] = 1

      return queryInterface.sequelize.query(`update memberships set "adminId" = ${nextAdminId[channelPhoneNumber]} where "id" = '${id}';`)
    }))
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('memberships', 'adminId')
  }
};
