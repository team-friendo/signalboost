const { isPhoneNumber } = require('../validations/phoneNumber')
const { defaultLanguage } = require('../../config')

const publicationOf = (sequelize, DataTypes) => {
  const publication = sequelize.define(
    'publication',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      publisherPhoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: isPhoneNumber,
      },
      channelPhoneNumber: {
        type: DataTypes.STRING,
        alowNull: false,
        validate: isPhoneNumber,
      },
      language: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: defaultLanguage,
      },
    },
    {},
  )

  publication.associate = db => {
    publication.belongsTo(db.channel)
  }

  return publication
}

module.exports = { publicationOf }
