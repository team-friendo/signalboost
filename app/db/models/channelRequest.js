const channelRequestOf = (sequelize, Sequelize) => {
  return sequelize.define('channelRequest', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
    },
    adminPhoneNumbers: {
      allowNull: false,
      type: Sequelize.JSON,
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
  })
}

module.exports = { channelRequestOf }
