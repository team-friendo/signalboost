const smsSenderOf = (sequelize, DataTypes) => {
  const smsSender = sequelize.define('smsSender', {
    phoneNumber: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    messagesSent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  })
  return smsSender
}

module.exports = { smsSenderOf }
