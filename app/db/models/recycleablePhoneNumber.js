const recycleablePhoneNumberOf = (sequelize, DataTypes) => {
  const recycleablePhoneNumber = sequelize.define('recycleablePhoneNumber', {
    channelPhoneNumber: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    whenEnqueued: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  })
  return recycleablePhoneNumber
}

module.exports = { recycleablePhoneNumberOf }
