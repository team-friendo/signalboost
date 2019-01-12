const phoneNumberPattern = /^\+(1|52)\d{10}$/

const isPhoneNumber = {
  is: {
    args: [phoneNumberPattern],
    msg: 'must be 10 digit phone number with US/CA/MX country code prefix',
  },
}

module.exports = { isPhoneNumber, phoneNumberPattern }
