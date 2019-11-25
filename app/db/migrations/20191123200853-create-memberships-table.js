'use strict'

const { isEmpty } = require('lodash')

module.exports = {
  // UP
  up: async (queryInterface, Sequelize) => {
    console.log('--- creating memberships table...')
    await queryInterface.createTable('memberships', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      type: {
        type: Sequelize.ENUM,
        allowNull: false,
        values: ['ADMIN', 'SUBSCRIBER'],
      },
      memberPhoneNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      channelPhoneNumber: {
        type: Sequelize.STRING,
        alowNull: false,
      },
      language: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: process.env.DEFAULT_LANGUAGE,
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
    console.log('...created memberships table!')

    // add indexes
    console.log('--- creating indexes...')
    await Promise.all([
      queryInterface.addIndex('memberships', {
        fields: ['channelPhoneNumber', 'type'],
      }),
      queryInterface.addIndex('memberships', {
        unique: true,
        fields: ['channelPhoneNumber', 'memberPhoneNumber'],
      }),
      queryInterface.addIndex('memberships', {
        fields: ['channelPhoneNumber', 'memberPhoneNumber', 'type'],
      }),
    ])
    console.log('...created indexes!')

    // migrate all admins from publications table to memberships table
    const publications = await queryInterface.sequelize
      .query('SELECT * from publications')
      .then(([, result]) => result.rows)

    console.log(`--- inserting ${publications.length} admin memberships...`)
    if (!isEmpty(publications)) {
      await queryInterface.bulkInsert(
        'memberships',
        publications.map(p => ({
          type: 'ADMIN',
          id: p.id,
          channelPhoneNumber: p.channelPhoneNumber,
          memberPhoneNumber: p.publisherPhoneNumber,
          language: p.language,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      )
    }
    console.log('...inserted admin memberships!')

    const subscriptions = await queryInterface.sequelize
      .query('SELECT * from subscriptions')
      .then(([, result]) => result.rows)

    // this will produce some uniqueness constraint errors, which is good!
    // that will block inserting subscribers that are already admins on the same channel!
    console.log(`--- inserting ${subscriptions.length} subscriber memberships...`)
    if (!isEmpty(subscriptions)) {
      await queryInterface.bulkInsert(
        'memberships',
        subscriptions.map(s => ({
          type: 'SUBSCRIBER',
          id: s.id,
          channelPhoneNumber: s.channelPhoneNumber,
          memberPhoneNumber: s.subscriberPhoneNumber,
          language: s.language,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      )
    }
    console.log('... inserted subscriber memberships!')

    // drop the subscriptions and publications tables
    console.log('--- dropping pub/sub tables...')
    await Promise.all([
      queryInterface.dropTable('publications'),
      queryInterface.dropTable('subscriptions'),
    ])
    console.log('... dropped pub/sub tables!')
  },

  // DOWN
  down: async (queryInterface, Sequelize) => {
    // recreate the subscriptions and publications tables
    await Promise.all([
      queryInterface.createTable('publications', {
        id: {
          allowNull: false,
          primaryKey: true,
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
        },
        publisherPhoneNumber: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        channelPhoneNumber: {
          type: Sequelize.STRING,
          alowNull: false,
        },
        language: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: process.env.DEFAULT_LANGUAGE,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      }),

      queryInterface.createTable('subscriptions', {
        id: {
          allowNull: false,
          primaryKey: true,
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
        },
        subscriberPhoneNumber: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        channelPhoneNumber: {
          type: Sequelize.STRING,
          alowNull: false,
        },
        language: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: process.env.DEFAULT_LANGUAGE,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      }),
    ])

    // migrate numbers back from memberships table
    const memberships = await queryInterface.sequelize.query('SELECT * from memberships')
    const publications = memberships
      .filter(m => m.type === 'ADMIN')
      .map(m => ({
        id: m.id,
        publisherPhoneNumber: m.memberPhoneNumber,
        channelPhoneNumber: m.channelPhoneNumber,
        language: m.language,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))
    const subscriptions = memberships
      .filter(m => m.type === 'SUBSCRIBER')
      .map(m => ({
        id: m.id,
        subscriberPhoneNumber: m.memberPhoneNumber,
        channelPhoneNumber: m.channelPhoneNumber,
        language: m.language,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))

    await Promise.all([
      isEmpty(publications)
        ? Promise.resolve()
        : queryInterface.bulkInsert('publications', publications),

      isEmpty(subscriptions)
        ? Promise.resolve()
        : queryInterface.bulkInsert('subscriptions', subscriptions),
    ])

    return queryInterface.dropTable('memberships')
  },
}
