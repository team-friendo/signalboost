const phoneNumberRepository = require('../../../db/repositories/phoneNumber')

const list = db =>
  phoneNumberRepository
    .list(db)
    .then(phoneNumbers => ({
      status: 'SUCCESS',
      count: phoneNumbers.length,
      phoneNumbers,
    }))
    .catch(error => ({
      status: 'ERROR',
      error,
    }))

module.exports = { list }
