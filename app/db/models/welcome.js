const welcomeOf = (sequelize, DataTypes) => {
  const welcome = sequelize.define(
    'welcome',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      channelPhoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      welcomedPhoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {},
  )

  welcome.associate = db => {
    welcome.belongsTo(db.channel)
  }

  return welcome
}

module.exports = { welcomeOf }
