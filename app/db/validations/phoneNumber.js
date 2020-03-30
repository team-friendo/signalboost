const phoneNumberPattern = /^\+\d{9,15}$/g

const isPhoneNumber = {
  is: {
    args: [phoneNumberPattern],
    msg: 'must be 9-15 digit phone number with country code prefix',
  },
}

// string -> boolean
const validatePhoneNumber = maybePhoneNumber => Boolean(maybePhoneNumber.match(phoneNumberPattern))

// string -> { input: string, phoneNumber: string? }
const parseValidPhoneNumber = input => {
  // `phoneNumber` field is a string if valid e164 number can be parsed from input, null otherwise
  //  see: https://www.twilio.com/docs/glossary/what-e164 for e164 definition
  const stripped = (input || '').replace(/["\-().\s]/g, '')
  return { input, phoneNumber: validatePhoneNumber(stripped) ? stripped : null }
}

module.exports = { isPhoneNumber, phoneNumberPattern, validatePhoneNumber, parseValidPhoneNumber }
