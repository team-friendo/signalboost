const { isSha256Hash } = require('../validations')
const eventTypes = {
  CHANNEL_CREATED: 'CHANNEL_CREATED',
  CHANNEL_DESTROYED: 'CHANNEL_DESTROYED',
  MEMBER_CREATED: 'MEMBER_CREATED',
  MEMBER_DESTROYED: 'MEMBER_DESTROYED',
}

const eventOf = (sequelize, Sequelize) =>
  sequelize.define('event', {
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
      validate: isSha256Hash,
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

module.exports = { eventTypes, eventOf }
