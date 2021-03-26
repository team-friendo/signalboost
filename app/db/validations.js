// PHONE NUMBERS

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
  const stripped = strip(input)
  return { input, phoneNumber: validatePhoneNumber(stripped) ? stripped : null }
}

// SHA256  HASH

const sha256Pattern = /^[a-fA-F0-9]{64}$/

const isSha256Hash = {
  is: {
    args: [sha256Pattern],
    msg: 'must be valid hex-encoded 32-byte sha256 hash',
  },
}

const strip = str => {
  const chars = (str || '').replace(/"/g, '').split('')
  const [hd, ...tail] = chars
  const strippedTail = tail.map(x => parseInt(x)).filter(x => !isNaN(x))
  return [hd, ...strippedTail].join('')
}

module.exports = {
  isPhoneNumber,
  isSha256Hash,
  parseValidPhoneNumber,
  phoneNumberPattern,
  sha256Pattern,
  validatePhoneNumber,
}
