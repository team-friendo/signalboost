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
const parseValidPhoneNumber = input => {
  const stripped = (input || '').replace(/["\-().\s]/g, '')
  const isValid = validatePhoneNumber(stripped)
  // TODO(aguestuser|2020-03-30):
  //  we could probably cut the `isValid` field from this return type
  //  since the phoneNumber field being null signals !isValid
  //  (at which point we could also inline the `isValid` evaluation below)
  return {
    isValid,
    phoneNumber: isValid ? stripped : null,
    input,
  }
}

module.exports = { isPhoneNumber, phoneNumberPattern, validatePhoneNumber, parseValidPhoneNumber }
