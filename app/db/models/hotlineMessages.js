const hotlineMessageOf = (sequelize, DataTypes) => {
  const hotlineMessage = sequelize.define('hotlineMessage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    channelPhoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: {
          tableName: 'channels',
        },
        key: 'phoneNumber',
      },
    },
    memberPhoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  })

  hotlineMessage.associate = db => {
    hotlineMessage.belongsTo(db.channel)
  }

  return hotlineMessage
}

module.exports = { hotlineMessageOf }
