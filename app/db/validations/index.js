const phoneNumberPattern = /^\+(1|52)\d{10}$/

const isPhoneNumber = {
  is: {
    args: [phoneNumberPattern],
    msg: 'must be 10 digit phone number with US/CA/MX country code prefix',
  },
}

// string -> boolean
const validatePhoneNumber = maybePhoneNumber => Boolean(maybePhoneNumber.match(phoneNumberPattern))

module.exports = { isPhoneNumber, phoneNumberPattern, validatePhoneNumber }
