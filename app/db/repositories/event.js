const app = require('../../../app')
const { sha256Hash } = require("../../util")

const log = (eventType, phoneNumber) =>
  app.db.event.create({
    type: eventType,
    phoneNumberHash: sha256Hash(phoneNumber),
  })

module.exports = { log }
