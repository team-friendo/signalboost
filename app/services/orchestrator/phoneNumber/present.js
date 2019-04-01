const phoneNumberRepository = require('../../../db/repositories/phoneNumber')

const list = (db, filter) =>
  phoneNumberRepository
    .list(db, filter)
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
