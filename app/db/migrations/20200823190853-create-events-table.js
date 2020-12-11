'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('events', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      type: {
        allowNull: false,
        type: Sequelize.ENUM,
        values: ['CHANNEL_CREATED', 'CHANNEL_DESTROYED', 'MEMBER_CREATED', 'MEMBER_DESTROYED'],
      },
      phoneNumberHash: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    const eventCount = await queryInterface.sequelize.query(
      'select count(*) from events',
      { type: Sequelize.QueryTypes.SELECT }
    ).then(([{count}]) => parseInt(count))

    console.log(`found ${eventCount} pre-existing events...`)

    if (eventCount === 0) {
      console.log('starting backfill...')

      const { v4: genUuid } = require('uuid')

      const hash = str =>
        require('crypto')
          .createHash('sha256')
          .update(str + process.env.SIGNALBOOST_HASH_SALT)
          .digest('hex')

      const channels = await queryInterface.sequelize.query(
        'select "phoneNumber", "createdAt" from channels',
        { type: Sequelize.QueryTypes.SELECT }
      )

      if (channels.length > 0) {
        console.log(`logging creation of ${channels.length} channels...`)
        await queryInterface.bulkInsert('events', channels.map(({ phoneNumber, createdAt }) => ({
          id: genUuid(),
          type: 'CHANNEL_CREATED',
          phoneNumberHash: hash(phoneNumber),
          createdAt,
          updatedAt: createdAt,
        })))
      }

      const members = await queryInterface.sequelize.query(`
      select "memberPhoneNumber" as "phoneNumber", min("createdAt") "createdAt"
        from memberships
        group by "memberPhoneNumber"
        order by "createdAt";
      `,
        { type: Sequelize.QueryTypes.SELECT }
      )

      if (members.length > 0) {
        console.log(`logging creation of ${members.length} members...`)
        await queryInterface.bulkInsert('events', members.map(({ phoneNumber, createdAt }) => ({
          id: genUuid(),
          type: 'MEMBER_CREATED',
          phoneNumberHash: hash(phoneNumber),
          createdAt,
          updatedAt: createdAt,
        })))
      }

      console.log('...backfill succeeded!')
    }

    return queryInterface.addIndex('events', {
      fields: ['phoneNumberHash']
    })
  },

  down: queryInterface => {
    return queryInterface.dropTable('events')
  }
};
