const isPhoneNumber = {
  is: {
    args: [/^\+(1|52)\d{10}$/],
    msg: 'must be 10 digit phone number with US/CA/MX country code prefix',
  },
}

module.exports = { isPhoneNumber }
