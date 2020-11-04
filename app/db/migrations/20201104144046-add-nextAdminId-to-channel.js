'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('channels', 'nextAdminId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    })

    const adminsPerChannel = await queryInterface.sequelize.query(`
      select "channelPhoneNumber", count(*) 
      from memberships where "type" = 'ADMIN' 
      group by "channelPhoneNumber";`
    ).then(([, result]) => result.rows)
    
    return Promise.all(adminsPerChannel.map(({ channelPhoneNumber, count }) => queryInterface.sequelize.query(`
      update channels set "nextAdminId" = ${count++}
      where "phoneNumber" = '${channelPhoneNumber}';
      `)
    ))
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('channels', 'nextAdminId')
  }
};
