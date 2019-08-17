const phoneNumberPattern = /^\+\d{9,15}$/g

const isPhoneNumber = {
  is: {
    args: [phoneNumberPattern],
    msg: 'must be 9-15 digit phone number with country code prefix',
  },
}

// string -> boolean
const validatePhoneNumber = maybePhoneNumber => Boolean(maybePhoneNumber.match(phoneNumberPattern))

// string -> { isValid: boolean, phoneNumber: string }
const parseValidPhoneNumber = userInput => {
  const stripped = userInput.replace(/["\-().\s]/g, '')
  return {
    isValid: validatePhoneNumber(stripped),
    phoneNumber: stripped,
  }
}

module.exports = { isPhoneNumber, phoneNumberPattern, validatePhoneNumber, parseValidPhoneNumber }
