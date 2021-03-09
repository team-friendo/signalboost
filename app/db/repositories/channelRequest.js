const app = require('../../../app')

const addToWaitlist = adminPhoneNumbers =>
  app.db.channelRequest.create({
    adminPhoneNumbers: JSON.stringify(adminPhoneNumbers),
  })

module.exports = { addToWaitlist }
